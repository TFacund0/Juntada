// ─── Encuentra el Color Correcto — Game Engine ──────────────────────────────
// dialed.gg-style color memory game, online version: a target color is shown
// to everyone at once, then hidden. Every player independently submits their
// best guess with a color picker, and each guess is scored 0-10 by how
// close it landed. Unlike Sintonía there's no single "psychic" role — it's a
// simultaneous free-for-all every round, same as everyone racing the clock.
//
// Phases: show (target visible to all, timed) -> guess (target hidden,
// everyone submits) -> result (scores revealed, scoreboard updated).
// start_round always re-enters "show" with a fresh target. If the room is
// configured to play a fixed number of rounds, it refuses once that count is
// reached — "new_game" resets score/history and starts fresh.

import type { Room } from "@juntada/shared-types";
import type { GameEngine } from "../engineTypes";
import { HEX_RE, randomTargetColor, scoreGuess } from "@juntada/color-correcto-scoring";

interface ColorCorrectoConfig {
  score: Record<string, number>;
  playMode: "endless" | "rounds";
  roundLimit: number;
  // 0 = sin límite — the guess phase then only advances once everyone's submitted.
  guessSeconds: number;
  [key: string]: unknown;
}

interface ColorCorrectoRound {
  target: string;
  showEndsAt: number;
  guessEndsAt: number | null;
  guesses: Record<string, string>;
  scores: Record<string, number> | null;
}

function cfg(room: Room): ColorCorrectoConfig {
  return room.config as ColorCorrectoConfig;
}

function round(room: Room): ColorCorrectoRound {
  return room.round as ColorCorrectoRound;
}

const MIN_PLAYERS = 2;
const SHOW_SECONDS = 5;

function createConfig(): ColorCorrectoConfig {
  return { score: {}, playMode: "endless", roundLimit: 5, guessSeconds: 0 };
}

function startRound(room: Room): { success?: true; error?: string } {
  if (room.players.length < MIN_PLAYERS) return { error: `Se necesitan al menos ${MIN_PLAYERS} jugadores` };
  const c = cfg(room);
  if (c.playMode === "rounds" && room.roundHistory.length >= c.roundLimit) {
    return { error: "Ya se jugaron todas las rondas configuradas" };
  }
  room.round = {
    target: randomTargetColor(),
    showEndsAt: Date.now() + SHOW_SECONDS * 1000,
    guessEndsAt: null,
    guesses: {},
    scores: null,
  } satisfies ColorCorrectoRound;
  room.phase = "show";
  return { success: true };
}

// Shared by the "show" timer running out (forceReadyAndAdvance) and
// maybeAdvance's own wall-clock check — starts the guess phase's own
// countdown (if the room's configured with one) so both entry points can't
// drift into computing a different guessEndsAt for the same round.
function startGuessPhase(room: Room): void {
  const c = cfg(room);
  round(room).guessEndsAt = c.guessSeconds > 0 ? Date.now() + c.guessSeconds * 1000 : null;
  room.phase = "guess";
}

function finishRound(room: Room): void {
  const r = round(room);
  const scores: Record<string, number> = {};
  Object.entries(r.guesses).forEach(([pid, guess]) => {
    scores[pid] = scoreGuess(r.target, guess);
  });
  Object.entries(scores).forEach(([pid, pts]) => {
    cfg(room).score[pid] = (cfg(room).score[pid] || 0) + pts;
  });
  r.scores = scores;
  room.phase = "result";
  room.roundHistory.push({ target: r.target, guesses: r.guesses, scores });
}

function maybeAdvance(room: Room): void {
  if (!room?.round) return;
  const r = round(room);
  if (room.phase === "show") {
    if (Date.now() >= r.showEndsAt) startGuessPhase(room);
    return;
  }
  if (room.phase !== "guess") return;
  const online = room.players.filter(p => p.online);
  if (online.length > 0 && online.every(p => r.guesses[p.id] != null)) finishRound(room);
}

function forceReadyAndAdvance(room: Room): void {
  if (room.phase === "show") {
    startGuessPhase(room);
    return;
  }
  // The guess timer ran out — score whoever already submitted, same as the
  // host's manual force_finish_round escape hatch.
  if (room.phase === "guess") finishRound(room);
}

function getPhaseTimerEnd(room: Room): number | null {
  if (!room.round) return null;
  if (room.phase === "show") return round(room).showEndsAt;
  if (room.phase === "guess") return round(room).guessEndsAt;
  return null;
}

function newGame(room: Room, playerId: string): { handled: boolean } {
  if (playerId !== room.hostId) return { handled: false };
  cfg(room).score = {};
  room.roundHistory.length = 0;
  room.round = null;
  room.phase = "lobby";
  room.players.forEach(p => {
    p.ready = false;
  });
  return { handled: true };
}

function handleAction(
  room: Room,
  playerId: string,
  action: string,
  payload: Record<string, unknown>,
): { handled: boolean; rerolled?: boolean } {
  switch (action) {
    case "new_game":
      return newGame(room, playerId);

    case "submit_guess": {
      if (!room.round || room.phase !== "guess") return { handled: false };
      // Locked in once submitted, same reasoning as Sintonía's submit_guess —
      // a reconnect mid-round shouldn't let someone resend after seeing others' colors.
      if (round(room).guesses[playerId] != null) return { handled: false };
      const value = payload?.value;
      if (typeof value !== "string" || !HEX_RE.test(value)) return { handled: false };
      round(room).guesses[playerId] = value;
      maybeAdvance(room);
      return { handled: true };
    }

    // Host-only escape hatch mirroring Sintonía's force_finish_round: scores
    // whoever already guessed instead of waiting forever on stragglers who
    // went offline mid-round.
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
  if (!room.round) return { ...gameProgress };
  const r = round(room);
  const onlineIds = room.players.filter(p => p.online).map(p => p.id);
  return {
    target: room.phase === "show" || room.phase === "result" ? r.target : null,
    showEndsAt: room.phase === "show" ? r.showEndsAt : null,
    guessEndsAt: room.phase === "guess" ? r.guessEndsAt : null,
    submittedCount: onlineIds.filter(id => r.guesses[id] != null).length,
    guessersOnline: onlineIds.length,
    guesses: room.phase === "result" ? r.guesses : null,
    scores: room.phase === "result" ? r.scores : null,
    ...gameProgress,
  };
}

function getPrivateView(room: Room, playerId: string): Record<string, unknown> | null {
  if (!room.round) return null;
  const r = round(room);
  return { myGuess: r.guesses[playerId] ?? null };
}

function getRevealMessage(room: Room): ({ type: string } & Record<string, unknown>) | null {
  if (!room.round) return null;
  return { type: "word_reveal", target: round(room).target };
}

const engine: GameEngine = {
  id: "color-correcto",
  minPlayers: MIN_PLAYERS,
  createConfig,
  startRound,
  maybeAdvance,
  handleAction,
  getPublicRoundView,
  getPrivateView,
  getPhaseTimerEnd,
  forceReadyAndAdvance,
  getRevealMessage,
};

module.exports = engine;
