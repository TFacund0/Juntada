// ─── Impostor Game Engine ────────────────────────────────────────────────────
// Implements the game-engine contract described in src/games/registry.js
// (and typed as GameEngine in ../engineTypes.ts). Owns everything specific to
// "who is the impostor": categories, word assignment, clues, voting and the
// impostor reveal. Knows nothing about WebSocket transport or generic
// room/player bookkeeping.
//
// Phases: round (see word, optionally write a clue) -> discussion (think,
// no new info; skippable early if everyone's ready) -> voting -> result.
// discussionTime = 0 skips the discussion phase entirely.

import type { Room } from "@juntada/shared-types";
import type { GameEngine } from "../engineTypes";

interface Category {
  label: string;
  icon: string;
  words: string[];
}

const { CATEGORIES } = require("@juntada/impostor-data") as { CATEGORIES: Record<string, Category> };
const { shuffle } = require("../../utils/shuffle");
const { timers } = require("../../state/roomStore") as { timers: Map<string, NodeJS.Timeout> };

interface ImpostorConfig {
  enabledCategories: Record<string, boolean>;
  numImpostors: number;
  hintsEnabled: boolean;
  clueTime: number;
  writtenClues: boolean;
  discussionTime: number;
  discussionUnlimited: boolean;
  [key: string]: unknown;
}

interface ImpostorRound {
  word: string;
  categoryKey: string;
  categoryLabel: string;
  categoryIcon: string;
  impostors: string[];
  clues: Record<string, string>;
  votes: Record<string, string>;
  skipVotes: string[];
  eliminated: string | null;
  revealed: boolean;
  wasImpostor?: boolean;
  timerEnd: number | null;
  discussionEnd: number | null;
  revoteCandidates: string[] | null;
  revoteCount: number;
  tally?: Record<string, number>;
}

function cfg(room: Room): ImpostorConfig {
  return room.config as ImpostorConfig;
}

function round(room: Room): ImpostorRound {
  return room.round as ImpostorRound;
}

const MIN_PLAYERS = 3;
// A tie at the top keeps re-voting among just the tied suspects rather than
// eliminating one at random — but cap it so a stubborn 1-1 tie between two
// players (who can just keep voting for each other) doesn't loop forever.
const MAX_REVOTES = 2;

function createConfig(): ImpostorConfig {
  return {
    enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: true }), {} as Record<string, boolean>),
    numImpostors: 1,
    hintsEnabled: true,
    clueTime: 90, // seconds, 0 = unlimited
    writtenClues: false, // require typing the clue instead of just saying it out loud
    discussionTime: 30, // seconds, 0 = skip the discussion phase entirely
    discussionUnlimited: false, // discussion phase happens but with no timer/auto-advance — players mark ready manually
  };
}

// A malformed update_config (bad client, typo) shouldn't be able to crash the
// server — anything that doesn't look like a real category map is ignored.
function activeCategoryKeys(room: Room): string[] {
  const enabled = cfg(room).enabledCategories;
  if (!enabled || typeof enabled !== "object") return [];
  return Object.keys(CATEGORIES).filter(k => enabled[k]);
}

function pickWord(room: Room, catKey: string, excludeWord: string | null = null): string | null {
  const cat = CATEGORIES[catKey];
  const used = (room.usedWords[catKey] as string[] | undefined) ?? [];
  const available = cat.words.filter(w => !used.includes(w) && w !== excludeWord);
  if (available.length === 0) return null;
  const word = available[Math.floor(Math.random() * available.length)];
  room.usedWords[catKey] = [...used, word];
  return word;
}

function stopRoomTimer(room: Room): void {
  const t = timers.get(room.code);
  if (t) {
    clearTimeout(t);
    timers.delete(room.code);
  }
}

function startRound(room: Room): { success?: true; error?: string } {
  if (room.players.length < MIN_PLAYERS) return { error: `Necesitás al menos ${MIN_PLAYERS} jugadores` };

  const activeCats = activeCategoryKeys(room);
  if (activeCats.length === 0) return { error: "No hay categorías activas" };
  const catKey = activeCats[Math.floor(Math.random() * activeCats.length)];
  const cat = CATEGORIES[catKey];
  const word = pickWord(room, catKey);
  if (!word) return { error: `Sin palabras en ${cat.label}` };

  const playerIds = shuffle(room.players.map(p => p.id)) as string[];
  const numImpostors = Number.isInteger(cfg(room).numImpostors) ? cfg(room).numImpostors : 1;
  const impostorCount = Math.max(1, Math.min(numImpostors, Math.floor(room.players.length / 2)));
  const impostors = playerIds.slice(0, impostorCount);

  const timerEnd = cfg(room).clueTime > 0 ? Date.now() + cfg(room).clueTime * 1000 : null;

  room.round = {
    word,
    categoryKey: catKey,
    categoryLabel: cat.label,
    categoryIcon: cat.icon,
    impostors,
    clues: {}, // playerId -> clueText
    votes: {}, // voterId -> suspectId
    skipVotes: [], // playerIds that asked for a different word this round
    eliminated: null,
    revealed: false,
    timerEnd,
    discussionEnd: null,
    revoteCandidates: null, // set of tied playerIds when a vote must be repeated
    revoteCount: 0,
  } satisfies ImpostorRound;
  room.phase = "round";
  room.players.forEach(p => {
    p.ready = false;
  });

  return { success: true };
}

// Majority of *online* players needed to swap the current word for a new one.
function skipThreshold(room: Room): number {
  const online = room.players.filter(p => p.online).length;
  return Math.floor(online / 2) + 1;
}

// skipVotes only ever grows (see skip_word below) — if a voter is later
// kicked, their id would otherwise linger there forever, forming a phantom
// vote that counts toward a threshold now computed from a smaller player
// list. Always read the count through this filter instead of skipVotes.length.
function activeSkipVotes(room: Room): string[] {
  const ids = room.players.map(p => p.id);
  return round(room).skipVotes.filter(id => ids.includes(id));
}

// Swaps the word for a fresh one from the same category, keeping the same
// impostors — this is meant to feel instant, not like starting the round
// over. Only falls back to a full re-shuffle (new category, new impostors)
// if that category has no words left to offer.
function rerollWord(room: Room): void {
  const word = pickWord(room, round(room).categoryKey, round(room).word);
  if (!word) {
    startRound(room);
    return;
  }

  round(room).word = word;
  round(room).skipVotes = [];
  room.players.forEach(p => {
    p.ready = false;
  });
  round(room).timerEnd = cfg(room).clueTime > 0 ? Date.now() + cfg(room).clueTime * 1000 : null;
}

function tallyVotes(room: Room): void {
  const r = round(room);
  const tally: Record<string, number> = {};
  room.players.forEach(p => {
    tally[p.id] = 0;
  });
  Object.values(r.votes).forEach(id => {
    tally[id] = (tally[id] || 0) + 1;
  });
  const maxVotes = Math.max(...Object.values(tally));
  const topVoted = Object.entries(tally)
    .filter(([, v]) => v === maxVotes)
    .map(([id]) => id);

  // Tie at the top: repeat the vote among just the tied suspects instead of
  // eliminating one at random, up to MAX_REVOTES times.
  if (topVoted.length > 1 && maxVotes > 0 && r.revoteCount < MAX_REVOTES) {
    r.revoteCandidates = topVoted;
    r.revoteCount += 1;
    r.votes = {};
    r.tally = tally;
    room.phase = "voting";
    return;
  }

  const eliminatedId = topVoted[Math.floor(Math.random() * topVoted.length)];
  const wasImpostor = r.impostors.includes(eliminatedId);
  r.eliminated = eliminatedId;
  r.revealed = true;
  r.tally = tally;
  r.wasImpostor = wasImpostor;
  room.phase = "result";
  room.roundHistory.push({
    word: r.word,
    categoryLabel: r.categoryLabel,
    categoryIcon: r.categoryIcon,
    impostors: r.impostors,
    eliminated: eliminatedId,
    wasImpostor,
    tally,
  });
}

function enterVoting(room: Room): void {
  room.phase = "voting";
  round(room).discussionEnd = null;
}

function enterDiscussionOrVoting(room: Room): void {
  stopRoomTimer(room); // clear the round's clue-timer, we're leaving that phase
  const discussionTime = Number.isFinite(cfg(room).discussionTime) ? cfg(room).discussionTime : 0;
  const unlimited = !!cfg(room).discussionUnlimited;
  // discussionTime === 0 without "unlimited" means the host chose to skip
  // the discussion phase entirely, straight to voting. With "unlimited" on,
  // the phase still happens but nothing forces it to end — same as clueTime
  // === 0 already does for the round phase — players advance by hand.
  if (discussionTime <= 0 && !unlimited) {
    enterVoting(room);
    return;
  }
  room.phase = "discussion";
  round(room).discussionEnd = unlimited ? null : Date.now() + discussionTime * 1000;
  room.players.forEach(p => {
    p.ready = false;
  });
}

// Re-checks whether the round/discussion/voting phase can advance now that a
// player's ready/vote status or online status changed.
function maybeAdvance(room: Room): void {
  if (!room?.round) return;
  const online = room.players.filter(p => p.online);
  if (online.length === 0) return;

  if (room.phase === "round" && online.every(p => p.ready)) {
    enterDiscussionOrVoting(room);
  } else if (room.phase === "discussion" && online.every(p => p.ready)) {
    stopRoomTimer(room);
    enterVoting(room);
  } else if (room.phase === "voting") {
    const votedCount = online.filter(p => round(room).votes[p.id] != null).length;
    if (votedCount >= online.length) {
      tallyVotes(room);
    }
  }
}

// Called by the transport layer when a scheduled phase timer fires: acts as
// if every online player just pressed "ready", then lets maybeAdvance decide
// where that leads (discussion, voting, or nothing yet).
function forceReadyAndAdvance(room: Room): void {
  room.players.forEach(p => {
    if (p.online) p.ready = true;
  });
  maybeAdvance(room);
}

function handleAction(
  room: Room,
  playerId: string,
  action: string,
  payload: Record<string, unknown>,
): { handled: boolean; rerolled?: boolean } {
  if (!room.round) return { handled: false };
  switch (action) {
    case "submit_clue":
      if (room.phase !== "round") return { handled: false };
      round(room).clues[playerId] = String(payload.clue ?? "").trim();
      return { handled: true };

    case "player_ready": {
      if (room.phase !== "round" && room.phase !== "discussion") return { handled: false };
      if (room.phase === "round" && cfg(room).writtenClues && !round(room).clues[playerId]) {
        return { handled: false };
      }
      const p = room.players.find(p => p.id === playerId);
      if (p) p.ready = true;
      maybeAdvance(room);
      return { handled: true };
    }

    case "vote": {
      if (room.phase !== "voting") return { handled: false };
      const { revoteCandidates } = round(room);
      const suspectId = payload.suspectId as string;
      const eligible = revoteCandidates
        ? room.players.some(p => p.id === suspectId && revoteCandidates.includes(p.id))
        : room.players.some(p => p.id === suspectId);
      if (!eligible) return { handled: false };
      round(room).votes[playerId] = suspectId;
      maybeAdvance(room);
      return { handled: true };
    }

    case "skip_word": {
      if (room.phase !== "round") return { handled: false };
      if (!round(room).skipVotes.includes(playerId)) round(room).skipVotes.push(playerId);
      if (activeSkipVotes(room).length >= skipThreshold(room)) {
        rerollWord(room);
        return { handled: true, rerolled: true };
      }
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

function getPublicRoundView(room: Room): Record<string, unknown> | null {
  if (!room.round) return null;
  const r = round(room);
  return {
    categoryLabel: r.categoryLabel,
    categoryIcon: r.categoryIcon,
    impostorCount: r.impostors.length,
    timerEnd: r.timerEnd,
    discussionEnd: r.discussionEnd,
    clues: r.clues,
    votes: r.votes,
    eliminated: r.eliminated,
    revealed: r.revealed,
    wasImpostor: r.wasImpostor,
    tally: r.tally,
    impostors: r.revealed ? r.impostors : undefined,
    skipVotes: activeSkipVotes(room).length,
    skipVotesNeeded: skipThreshold(room),
    revoteCandidates: r.revoteCandidates,
    revoteCount: r.revoteCount,
  };
}

function getPrivateView(room: Room, playerId: string): Record<string, unknown> | null {
  if (!room.round) return null;
  const r = round(room);
  const isImpostor = r.impostors.includes(playerId);
  return {
    isImpostor,
    word: isImpostor ? null : r.word,
    hint: isImpostor && cfg(room).hintsEnabled ? `La categoría es ${r.categoryLabel}, pero no sabés cuál es la palabra exacta.` : null,
  };
}

// Extra broadcast fired the moment a round resolves, so every screen can show
// the reveal even if the "result" state's round object gets replaced later.
function getRevealMessage(room: Room): ({ type: string } & Record<string, unknown>) | null {
  if (!room.round) return null;
  const r = round(room);
  return { type: "word_reveal", word: r.word, categoryLabel: r.categoryLabel };
}

// The phase-relevant timestamp the transport layer should schedule an
// auto-advance for (see forceReadyAndAdvance), or null if none applies.
function getPhaseTimerEnd(room: Room): number | null {
  if (room.phase === "round") return round(room)?.timerEnd ?? null;
  if (room.phase === "discussion") return round(room)?.discussionEnd ?? null;
  return null;
}

const engine: GameEngine = {
  id: "impostor",
  minPlayers: MIN_PLAYERS,
  createConfig,
  startRound,
  maybeAdvance,
  forceReadyAndAdvance,
  handleAction,
  getPublicRoundView,
  getPrivateView,
  getRevealMessage,
  getPhaseTimerEnd,
};

module.exports = engine;
