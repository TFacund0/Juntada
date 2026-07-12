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
  turnIdx: number;
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
  return { score: {}, turnIdx: 0, playMode: "endless", roundLimit: 5 };
}

function pickSpectrum(room: Room): { left: string; right: string } {
  const key = ([l, r]: [string, string]) => `${l}|${r}`;
  const used = (room.usedWords.spectrums as string[] | undefined) || [];
  let available = SPECTRUMS.filter(pair => !used.includes(key(pair)));
  if (available.length === 0) {
    room.usedWords.spectrums = [];
    available = SPECTRUMS;
  }
  const [left, right] = available[Math.floor(Math.random() * available.length)];
  room.usedWords.spectrums = [...used, key([left, right])];
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
  if (!room?.round || room.phase !== "guess") return;
  const online = room.players.filter(p => p.online && p.id !== round(room).psychicId);
  if (online.length === 0) return;
  if (online.every(p => round(room).guesses[p.id] != null)) finishRound(room);
}

// Only the host can finalize this step — payload lets them override who's
// psychic (a specific id, or "random"). The spectrum pair itself is chosen
// next, by the psychic, in the "spectrum" phase (see submit_spectrum below).
function confirmRoundSetup(room: Room, playerId: string, payload: Record<string, unknown>): { handled: boolean; rerolled?: boolean } {
  if (room.phase !== "setup") return { handled: false };
  if (playerId !== room.hostId) return { handled: false };

  let psychicId = payload?.psychicId as string | undefined;
  if (!psychicId || psychicId === "random" || !room.players.some(p => p.id === psychicId)) {
    psychicId = room.players[Math.floor(Math.random() * room.players.length)].id;
  }
  const psychicIdx = room.players.findIndex(p => p.id === psychicId);

  cfg(room).turnIdx = psychicIdx + 1;
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
      const value = payload?.value as number;
      if (!Number.isInteger(value) || value < 0 || value > 100) return { handled: false };
      round(room).guesses[playerId] = value;
      maybeAdvance(room);
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
    const turnIdx = c.turnIdx || 0;
    const lastRound = room.roundHistory[room.roundHistory.length - 1] as { left?: string; right?: string } | undefined;
    return {
      setup: true,
      suggestedPsychicId: room.players[turnIdx % room.players.length]?.id ?? null,
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
      ...gameProgress,
    };
  }

  const guessersOnline = room.players.filter(p => p.online && p.id !== r.psychicId).length;
  return {
    left: r.left,
    right: r.right,
    psychicId: r.psychicId,
    clue: r.clue,
    submittedCount: Object.keys(r.guesses).length,
    guessersOnline,
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
  return { isPsychic, target: isPsychic ? r.target : null };
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
