// ─── Sintonía Game Engine ────────────────────────────────────────────────────
// Wavelength-style: each round a different player is the "psíquico" — they see
// a secret 0-100 target on a dial between two opposite concepts (public to
// everyone) and write a clue phrase for it. Everyone else then submits their
// own guess at where the target is. Points are competitive: each guesser
// scores based on how close their own guess landed, and the psychic scores
// the sum of every guesser's points (a clue that gets everyone close is worth
// as much as the whole group combined).
//
// Phases: setup (host picks who's psychic) -> spectrum (the psychic picks
// which pair of concepts to use — repeat the last one, a random one, or one
// they type themselves) -> clue (psychic writes the phrase) -> guess
// (everyone else submits a value) -> result (target revealed, points awarded).
// start_round always re-enters "setup"; that's what powers both "Iniciar
// ronda" from the lobby and "Nueva ronda" after a result. If the room is
// configured to play a fixed number of rounds, start_round refuses once that
// count is reached — "new_game" resets the score/history and starts fresh.

import type { Room } from "@juntada/shared-types";
import type { GameEngine } from "../engineTypes";

const { SPECTRUMS } = require("@juntada/sintonia-data") as { SPECTRUMS: [string, string][] };
const { scoreFor } = require("@juntada/sintonia-scoring") as typeof import("@juntada/sintonia-scoring");

interface SintoniaConfig {
  score: Record<string, number>;
  // Anchored to the last psychic's identity rather than a raw array index —
  // an index would silently skip or repeat someone once a player joins or
  // leaves between rounds, since it'd then point at a different position in
  // the (now different-sized) room.players than originally intended.
  lastPsychicId: string | null;
  playMode: "endless" | "rounds";
  roundLimit: number;
  [key: string]: unknown;
}

interface SintoniaRound {
  left: string | null;
  right: string | null;
  target: number | null;
  psychicId: string;
  clue: string | null;
  guesses: Record<string, number>;
  pointsByPlayer: Record<string, number> | null;
  psychicBonus: number | null;
}

function cfg(room: Room): SintoniaConfig {
  return room.config as SintoniaConfig;
}

function round(room: Room): SintoniaRound {
  return room.round as SintoniaRound;
}

const MIN_PLAYERS = 2;

function randomTarget(): number {
  return 8 + Math.floor(Math.random() * 85); // 8..92, evita los extremos
}

function createConfig(): SintoniaConfig {
  return { score: {}, lastPsychicId: null, playMode: "endless", roundLimit: 5 };
}

// Whoever comes right after the last round's psychic, in the current player
// order — anchored to that player's identity (not a raw counter) so it stays
// fair even if someone joined or left since the last round.
function nextSuggestedPsychicId(room: Room): string | null {
  const lastId = cfg(room).lastPsychicId;
  const idx = lastId ? room.players.findIndex(p => p.id === lastId) : -1;
  return room.players[idx === -1 ? 0 : (idx + 1) % room.players.length]?.id ?? null;
}

const spectrumKey = (left: string, right: string): string => `${left}|${right}`;
const spectrumKeys = new Set(SPECTRUMS.map(([l, r]) => spectrumKey(l, r)));

// Records a pair as used, resetting the pool once every built-in pair has
// come up instead of growing this list forever — shared by pickSpectrum and
// submitSpectrum's manual/preview-confirmed path so a pair chosen by the
// client (see the frontend's own random-preview picker, which filters
// against getPublicRoundView's usedSpectrums) still counts toward the same
// dedup pool the server tracks. A pair typed by hand that isn't actually one
// of SPECTRUMS is a no-op here — there's no fixed pool to dedup a one-off
// custom phrase against, and counting it would throw off the "every built-in
// pair has come up" check below, resetting the real cycle early.
function recordSpectrumUsed(room: Room, left: string, right: string): void {
  const key = spectrumKey(left, right);
  if (!spectrumKeys.has(key)) return;
  const used = (room.usedWords.spectrums as string[] | undefined) || [];
  const next = new Set(used);
  next.add(key);
  // Once every built-in pair has come up, start a fresh cycle — but keep
  // just this one excluded so the very next pick can't immediately repeat
  // the pair that just finished.
  room.usedWords.spectrums = next.size >= SPECTRUMS.length ? [key] : [...next];
}

function pickSpectrum(room: Room): { left: string; right: string } {
  const used = (room.usedWords.spectrums as string[] | undefined) || [];
  const available = SPECTRUMS.filter(pair => !used.includes(spectrumKey(pair[0], pair[1])));
  const pool = available.length > 0 ? available : SPECTRUMS;
  const [left, right] = pool[Math.floor(Math.random() * pool.length)];
  recordSpectrumUsed(room, left, right);
  return { left, right };
}

// Enters the "choose psychic / choose spectrum" step. No round-specific data
// is committed yet — getPublicRoundView derives the suggested defaults live
// from room state so they always reflect the current player list.
function startRound(room: Room): { success?: true; error?: string } {
  if (room.players.length < MIN_PLAYERS) return { error: `Se necesitan al menos ${MIN_PLAYERS} jugadores` };
  const c = cfg(room);
  if (c.playMode === "rounds" && room.roundHistory.length >= c.roundLimit) {
    return { error: "Ya se jugaron todas las rondas configuradas" };
  }
  room.round = null;
  room.phase = "setup";
  return { success: true };
}

function finishRound(room: Room): void {
  const r = round(room);
  const target = r.target!;
  const guesserIds = Object.keys(r.guesses);
  const pointsByPlayer: Record<string, number> = {};
  guesserIds.forEach(pid => {
    const diff = Math.abs(r.guesses[pid] - target);
    pointsByPlayer[pid] = scoreFor(diff);
  });
  // El psíquico gana lo mismo que sumaron entre todos los que adivinaron —
  // así una buena pista (que acerca a todos) vale tanto como acertar uno solo.
  const psychicBonus = guesserIds.reduce((sum, pid) => sum + pointsByPlayer[pid], 0);
  pointsByPlayer[r.psychicId] = (pointsByPlayer[r.psychicId] || 0) + psychicBonus;

  Object.entries(pointsByPlayer).forEach(([pid, pts]) => {
    cfg(room).score[pid] = (cfg(room).score[pid] || 0) + pts;
  });

  r.pointsByPlayer = pointsByPlayer;
  r.psychicBonus = psychicBonus;
  room.phase = "result";
  room.roundHistory.push({
    left: r.left,
    right: r.right,
    target,
    psychicId: r.psychicId,
    guesses: r.guesses,
    pointsByPlayer,
    psychicBonus,
  });
}

function maybeAdvance(room: Room): void {
  if (!room?.round) return;
  const r = round(room);

  // The psychic is the only one who can act during spectrum/clue (pick the
  // spectrum, write the clue) — if they're truly gone (kicked, by timeout
  // or by the host; a merely-offline psychic still gets the usual reconnect
  // grace period, same as everywhere else) nobody else can ever move the
  // round forward. Bail back to "setup" to pick a new psychic instead of
  // leaving the room stuck on a phase that can never finish. Scoped to just
  // these two phases — "guess" doesn't need the psychic present anymore
  // (finishRound only reads what they already submitted), and "result" is
  // a finished round already recorded in roundHistory; resetting either of
  // those would yank a working screen out from under everyone else for no
  // reason.
  if ((room.phase === "spectrum" || room.phase === "clue") && !room.players.some(p => p.id === r.psychicId)) {
    room.round = null;
    room.phase = "setup";
    return;
  }

  if (room.phase !== "guess") return;
  const online = room.players.filter(p => p.online && p.id !== r.psychicId);
  if (online.length === 0) return;
  if (online.every(p => r.guesses[p.id] != null)) finishRound(room);
}

// Only the host can finalize this step — payload lets them override who's
// psychic (a specific id, or "random"). The spectrum pair itself is chosen
// next, by the psychic, in the "spectrum" phase (see submit_spectrum below).
function confirmRoundSetup(room: Room, playerId: string, payload: Record<string, unknown>): { handled: boolean; rerolled?: boolean } {
  if (room.phase !== "setup") return { handled: false };
  if (playerId !== room.hostId) return { handled: false };
  // Same round-limit check startRound already makes before ever reaching
  // "setup" — re-checked here too since a gone-psychic reset (see
  // maybeAdvance) can also land the room back in "setup" without going
  // through startRound, and the client's own "Nueva partida" gate could be
  // stale by the time this arrives.
  const c = cfg(room);
  if (c.playMode === "rounds" && room.roundHistory.length >= c.roundLimit) return { handled: false };

  let psychicId = payload?.psychicId as string | undefined;
  if (!psychicId || psychicId === "random" || !room.players.some(p => p.id === psychicId)) {
    psychicId = room.players[Math.floor(Math.random() * room.players.length)].id;
  }
  cfg(room).lastPsychicId = psychicId;
  room.round = {
    left: null,
    right: null,
    target: null,
    psychicId,
    clue: null,
    guesses: {},
    pointsByPlayer: null,
    psychicBonus: null,
  } satisfies SintoniaRound;
  room.phase = "spectrum";
  return { handled: true, rerolled: true }; // everyone needs to know who the fresh psychic is
}

// The assigned psychic picks the spectrum pair — repeat the last round's, a
// random one from the pool, or one they type themselves — which locks it in
// immediately and moves straight to the clue phase, no approval needed.
function submitSpectrum(room: Room, playerId: string, payload: Record<string, unknown>): { handled: boolean; rerolled?: boolean } {
  if (!room.round || room.phase !== "spectrum") return { handled: false };
  if (playerId !== round(room).psychicId) return { handled: false };

  const mode = String(payload?.mode || "random");
  const lastRound = room.roundHistory[room.roundHistory.length - 1] as { left?: string; right?: string } | undefined;
  let left: string, right: string;
  if (mode === "same" && lastRound) {
    left = lastRound.left!;
    right = lastRound.right!;
  } else if (mode === "manual" && String(payload?.left || "").trim() && String(payload?.right || "").trim()) {
    left = String(payload.left).trim();
    right = String(payload.right).trim();
    // The client's own "random from the base" picker sends its pick through
    // as "manual" too (see RoundView.tsx's confirmSpectrum) so what's used
    // always matches exactly what was last previewed — record it here too,
    // otherwise the server's dedup pool would never see any pair chosen this
    // way and could repeat it far sooner than SPECTRUMS.length rounds later.
    recordSpectrumUsed(room, left, right);
  } else {
    ({ left, right } = pickSpectrum(room));
  }

  round(room).left = left;
  round(room).right = right;
  round(room).target = randomTarget();
  room.phase = "clue";
  return { handled: true, rerolled: true }; // fresh private info (target) for everyone
}

// Host-only: wipes the accumulated score and round history and starts a
// fresh round-setup step, for after a fixed-round-count game has ended.
function newGame(room: Room, playerId: string): { handled: boolean } {
  if (playerId !== room.hostId) return { handled: false };
  cfg(room).score = {};
  room.roundHistory.length = 0;
  // A brand-new match shouldn't still avoid pairs used in the *previous*
  // match — those are unrelated games from the players' perspective.
  room.usedWords.spectrums = [];
  const res = startRound(room);
  return { handled: !!res.success };
}

function handleAction(
  room: Room,
  playerId: string,
  action: string,
  payload: Record<string, unknown>,
): { handled: boolean; rerolled?: boolean } {
  switch (action) {
    case "confirm_round_setup":
      return confirmRoundSetup(room, playerId, payload);

    case "submit_spectrum":
      return submitSpectrum(room, playerId, payload);

    case "new_game":
      return newGame(room, playerId);

    case "submit_clue": {
      if (!room.round || room.phase !== "clue") return { handled: false };
      if (playerId !== round(room).psychicId) return { handled: false };
      const clue = String(payload.clue || "").trim();
      if (!clue) return { handled: false };
      round(room).clue = clue;
      room.phase = "guess";
      return { handled: true };
    }

    case "submit_guess": {
      if (!room.round || room.phase !== "guess") return { handled: false };
      if (playerId === round(room).psychicId) return { handled: false };
      // Locked in once submitted — otherwise a refresh/reconnect mid-round
      // (which resets the client's own local "already guessed" state, see
      // RoundView.tsx's guessSubmitted) would let someone resend a different
      // value for the same round after seeing others' reactions to the clue.
      if (round(room).guesses[playerId] != null) return { handled: false };
      const value = payload?.value as number;
      if (!Number.isInteger(value) || value < 0 || value > 100) return { handled: false };
      round(room).guesses[playerId] = value;
      maybeAdvance(room);
      return { handled: true };
    }

    // Host-only escape hatch for the corner case maybeAdvance can't resolve
    // on its own: every guesser offline at once (or the last one dropping),
    // which leaves the round waiting forever since nobody's left online to
    // submit and nothing else re-triggers maybeAdvance. Scores whoever did
    // manage to guess before that happened — same math as a normal finish,
    // just not waiting on stragglers who may never come back.
    case "force_finish_round": {
      if (playerId !== room.hostId) return { handled: false };
      if (!room.round || room.phase !== "guess") return { handled: false };
      finishRound(room);
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

function getPublicRoundView(room: Room): Record<string, unknown> | null {
  const c = cfg(room);
  const gameProgress = { playMode: c.playMode, roundLimit: c.roundLimit, roundsPlayed: room.roundHistory.length };

  if (room.phase === "setup") {
    const lastRound = room.roundHistory[room.roundHistory.length - 1] as { left?: string; right?: string } | undefined;
    return {
      setup: true,
      suggestedPsychicId: nextSuggestedPsychicId(room),
      lastSpectrum: lastRound ? { left: lastRound.left, right: lastRound.right } : null,
      ...gameProgress,
    };
  }
  if (!room.round) return null;
  const r = round(room);

  if (room.phase === "spectrum") {
    const lastRound = room.roundHistory[room.roundHistory.length - 1] as { left?: string; right?: string } | undefined;
    return {
      psychicId: r.psychicId,
      lastSpectrum: lastRound ? { left: lastRound.left, right: lastRound.right } : null,
      // Lets the psychic's own "random from the base" client-side preview
      // (RoundView.tsx's pickRandomSpectrum) filter out pairs already used
      // this cycle, instead of previewing (and then confirming) a repeat —
      // see recordSpectrumUsed for how this pool actually gets updated.
      usedSpectrums: (room.usedWords.spectrums as string[] | undefined) || [],
      ...gameProgress,
    };
  }

  const onlineGuesserIds = room.players.filter(p => p.online && p.id !== r.psychicId).map(p => p.id);
  return {
    left: r.left,
    right: r.right,
    psychicId: r.psychicId,
    clue: r.clue,
    // Counted against the same online-only pool as guessersOnline (not
    // Object.keys(r.guesses).length) — otherwise a guess from someone who's
    // since gone offline (or, edge case, been kicked) keeps counting
    // forever, which can even show a numerator bigger than the
    // denominator once they're no longer online.
    submittedCount: onlineGuesserIds.filter(id => r.guesses[id] != null).length,
    guessersOnline: onlineGuesserIds.length,
    target: room.phase === "result" ? r.target : null,
    guesses: room.phase === "result" ? r.guesses : null,
    pointsByPlayer: room.phase === "result" ? r.pointsByPlayer : null,
    psychicBonus: room.phase === "result" ? r.psychicBonus : null,
    ...gameProgress,
  };
}

function getPrivateView(room: Room, playerId: string): Record<string, unknown> | null {
  const r = room.round ? round(room) : null;
  if (!r || room.phase === "setup") return null;
  const isPsychic = playerId === r.psychicId;
  // Lets a client that refreshed/reconnected mid-"guess" restore its own
  // "already submitted" UI instead of showing the slider again — submitting
  // from there would just be rejected now that submit_guess locks the first
  // value in (see handleAction), but the player deserves to see their
  // confirmed state rather than a form that silently fails.
  return { isPsychic, target: isPsychic ? r.target : null, myGuess: r.guesses[playerId] ?? null };
}

function getRevealMessage(room: Room): ({ type: string } & Record<string, unknown>) | null {
  if (!room.round) return null;
  const r = round(room);
  return { type: "word_reveal", target: r.target, left: r.left, right: r.right };
}

const engine: GameEngine = {
  id: "sintonia",
  minPlayers: MIN_PLAYERS,
  createConfig,
  startRound,
  maybeAdvance,
  handleAction,
  getPublicRoundView,
  getPrivateView,
  getRevealMessage,
};

module.exports = engine;
