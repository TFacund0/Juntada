// ─── Tutifrutti Game Engine ──────────────────────────────────────────────────
// Implements the game-engine contract described in src/games/registry.js.
// Stop/Basta: a letter is drawn, everyone fills a shared list of categories
// with a word starting with that letter, then the group marks each answer
// valid/invalid before points are tallied.
//
// Phases: setup (letter drawn, host can reroll) -> writing (everyone fills
// categories, ends by timer or "basta") -> review (mark valid/invalid) ->
// result (points for the round + running standings).

import type { Room } from "@juntada/shared-types";
import type { GameEngine } from "../engineTypes";

interface Category {
  id: string;
  label: string;
  icon?: string;
}

const { DEFAULT_CATEGORIES, LETTERS } = require("@juntada/tutifruti-data") as {
  DEFAULT_CATEGORIES: Category[];
  LETTERS: string[];
};

const MIN_PLAYERS = 2;

interface TutifrutiConfig {
  score: Record<string, number>;
  rounds: number;
  endMode: "timer" | "basta";
  roundTime: number;
  activeCategories: Record<string, boolean>;
  customCategories: Category[];
  [key: string]: unknown;
}

interface AnswerBreakdown {
  word: string;
  valid: boolean;
  wrongLetter: boolean;
  duplicate: boolean;
  points: number;
  ticks: number;
  crosses: number;
}

interface TutifrutiRound {
  letter: string;
  rerollsUsed: number;
  categories: Category[];
  endMode: "timer" | "basta";
  timerEnd: number | null;
  bastaBy: string | null;
  answers: Record<string, Record<string, string>>;
  marks: Record<string, Record<string, Record<string, boolean>>>;
  pointsByPlayer: Record<string, number> | null;
  breakdown: Record<string, Record<string, AnswerBreakdown>> | null;
  reviewConfirmed?: Record<string, boolean>;
}

function cfg(room: Room): TutifrutiConfig {
  return room.config as TutifrutiConfig;
}

function round(room: Room): TutifrutiRound {
  return room.round as TutifrutiRound;
}

function createConfig(): TutifrutiConfig {
  return {
    score: {},
    rounds: 5,
    endMode: "timer", // "timer" | "basta"
    roundTime: 90, // seconds, used when endMode === "timer"
    activeCategories: DEFAULT_CATEGORIES.reduce((a, c) => ({ ...a, [c.id]: true }), {} as Record<string, boolean>),
    customCategories: [], // [{ id, label }]
  };
}

// A malformed update_config shouldn't be able to crash the server — anything
// that doesn't look like real config data is ignored.
function activeCategories(room: Room): Category[] {
  const enabled = cfg(room).activeCategories;
  const defaults = DEFAULT_CATEGORIES.filter(c => enabled && typeof enabled === "object" && enabled[c.id]);
  const custom = Array.isArray(cfg(room).customCategories) ? cfg(room).customCategories : [];
  return [...defaults, ...custom.filter(c => c && c.id && c.label)];
}

function normalizeWord(word: string | undefined): string {
  return (word || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function pickLetter(room: Room): string {
  const used = (room.usedWords.letters as string[] | undefined) || [];
  let available = LETTERS.filter(l => !used.includes(l));
  if (available.length === 0) {
    room.usedWords.letters = [];
    available = LETTERS;
  }
  return available[Math.floor(Math.random() * available.length)];
}

function startRound(room: Room): { success?: true; error?: string } {
  if (room.players.length < MIN_PLAYERS) return { error: `Se necesitan al menos ${MIN_PLAYERS} jugadores` };
  if (room.roundHistory.length >= cfg(room).rounds) {
    return { error: "Ya se jugaron todas las rondas configuradas" };
  }
  const cats = activeCategories(room);
  if (cats.length === 0) return { error: "No hay categorías activas" };

  room.round = {
    letter: pickLetter(room),
    rerollsUsed: 0,
    categories: cats,
    endMode: cfg(room).endMode === "basta" ? "basta" : "timer",
    timerEnd: null,
    bastaBy: null,
    answers: {},
    marks: {},
    pointsByPlayer: null,
    breakdown: null,
  } satisfies TutifrutiRound;
  room.phase = "setup";
  room.players.forEach(p => {
    p.ready = false;
  });
  return { success: true };
}

function enterReview(room: Room): void {
  room.phase = "review";
  const r = round(room);
  r.marks = {};
  r.reviewConfirmed = {};
  room.players.forEach(p => {
    r.marks[p.id] = {};
  });
}

function finishRound(room: Room): void {
  const r = round(room);
  const players = room.players;
  const breakdown: Record<string, Record<string, AnswerBreakdown>> = {};
  const pointsByPlayer: Record<string, number> = {};

  players.forEach(p => {
    breakdown[p.id] = {};
    pointsByPlayer[p.id] = 0;
  });

  r.categories.forEach(cat => {
    // Normalized word -> list of playerIds that wrote it, to detect duplicates.
    const wordsByPlayer: Record<string, string> = {};
    players.forEach(p => {
      const raw = (r.answers[p.id] || {})[cat.id] || "";
      wordsByPlayer[p.id] = raw.trim();
    });
    const normalizedCounts: Record<string, number> = {};
    players.forEach(p => {
      const norm = normalizeWord(wordsByPlayer[p.id]);
      if (!norm) return;
      normalizedCounts[norm] = (normalizedCounts[norm] || 0) + 1;
    });

    const normLetter = normalizeWord(r.letter);

    players.forEach(p => {
      const word = wordsByPlayer[p.id];
      if (!word) {
        breakdown[p.id][cat.id] = { word: "", valid: false, wrongLetter: false, duplicate: false, points: 0, ticks: 0, crosses: 0 };
        return;
      }
      const marksForWord = (r.marks[p.id] || {})[cat.id] || {};
      const values = Object.values(marksForWord);
      const ticks = values.filter(v => v === true).length;
      const crosses = values.filter(v => v === false).length;
      // A word that doesn't even start with the round's letter is invalid
      // no matter how anyone voted — no amount of ticks saves it.
      const wrongLetter = !normalizeWord(word).startsWith(normLetter);
      const valid = !wrongLetter && crosses <= ticks;
      const duplicate = valid && normalizedCounts[normalizeWord(word)] > 1;
      const points = !valid ? 0 : duplicate ? 5 : 10;
      breakdown[p.id][cat.id] = { word, valid, wrongLetter, duplicate, points, ticks, crosses };
      pointsByPlayer[p.id] += points;
    });
  });

  players.forEach(p => {
    cfg(room).score[p.id] = (cfg(room).score[p.id] || 0) + pointsByPlayer[p.id];
  });

  r.pointsByPlayer = pointsByPlayer;
  r.breakdown = breakdown;
  room.phase = "result";
  room.roundHistory.push({
    letter: r.letter,
    categories: r.categories,
    pointsByPlayer,
    breakdown,
  });
  room.usedWords.letters = [...((room.usedWords.letters as string[] | undefined) || []), r.letter];
}

// Writing normally ends via timer or "basta" — but with a long timer, once
// every online player has marked themselves done there's no reason to make
// everyone sit through the rest of the clock, so that also advances early.
// Review ends once every online player has confirmed the scores, not just
// the host — see the "confirm_review" action below.
function maybeAdvance(room: Room): void {
  if (!room?.round) return;
  const online = room.players.filter(p => p.online);
  if (online.length === 0) return;
  if (room.phase === "writing" && online.every(p => p.ready)) {
    enterReview(room);
  } else if (room.phase === "review" && online.every(p => round(room).reviewConfirmed?.[p.id])) {
    finishRound(room);
  }
}

function forceReadyAndAdvance(room: Room): void {
  if (room.phase === "writing") enterReview(room);
}

function getPhaseTimerEnd(room: Room): number | null {
  if (room.phase === "writing" && round(room)?.endMode === "timer") return round(room).timerEnd;
  return null;
}

function handleAction(room: Room, playerId: string, action: string, payload: Record<string, unknown>): { handled: boolean } {
  if (!room.round) return { handled: false };
  const r = round(room);

  switch (action) {
    case "confirm_letter": {
      if (room.phase !== "setup") return { handled: false };
      if (playerId !== room.hostId) return { handled: false };
      if (payload?.reroll) {
        r.letter = pickLetter(room);
        r.rerollsUsed += 1;
        return { handled: true };
      }
      room.phase = "writing";
      r.timerEnd = r.endMode === "timer" ? Date.now() + cfg(room).roundTime * 1000 : null;
      return { handled: true };
    }

    case "submit_answers": {
      if (room.phase !== "writing") return { handled: false };
      const answers = payload?.answers as Record<string, unknown> | undefined;
      if (!answers || typeof answers !== "object") return { handled: false };
      const validIds = new Set(r.categories.map(c => c.id));
      const current = r.answers[playerId] || {};
      const next = { ...current };
      Object.entries(answers).forEach(([catId, word]) => {
        if (validIds.has(catId) && typeof word === "string") next[catId] = word.slice(0, 60);
      });
      r.answers[playerId] = next;
      return { handled: true };
    }

    case "call_basta": {
      if (room.phase !== "writing" || r.endMode !== "basta") return { handled: false };
      r.bastaBy = playerId;
      enterReview(room);
      return { handled: true };
    }

    // Lets each player flag "I'm done" during a timed round — once every
    // online player has, there's no reason to keep waiting out the clock.
    case "player_ready": {
      if (room.phase !== "writing") return { handled: false };
      const p = room.players.find(p => p.id === playerId);
      if (p) p.ready = true;
      maybeAdvance(room);
      return { handled: true };
    }

    case "mark_word": {
      if (room.phase !== "review") return { handled: false };
      const targetPlayerId = payload?.targetPlayerId as string;
      const categoryId = payload?.categoryId as string;
      const valid = payload?.valid;
      if (typeof valid !== "boolean") return { handled: false };
      if (!r.categories.some(c => c.id === categoryId)) return { handled: false };
      if (!room.players.some(p => p.id === targetPlayerId)) return { handled: false };
      if (!(r.answers[targetPlayerId] || {})[categoryId]) return { handled: false };
      if (!r.marks[targetPlayerId]) r.marks[targetPlayerId] = {};
      if (!r.marks[targetPlayerId][categoryId]) r.marks[targetPlayerId][categoryId] = {};
      r.marks[targetPlayerId][categoryId][playerId] = valid;
      return { handled: true };
    }

    // Every online player has to confirm before the round's scores are
    // tallied — not just the host — so nobody's marks get cut off early.
    case "confirm_review": {
      if (room.phase !== "review") return { handled: false };
      if (!r.reviewConfirmed) r.reviewConfirmed = {};
      r.reviewConfirmed[playerId] = true;
      maybeAdvance(room);
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

function getPublicRoundView(room: Room): Record<string, unknown> | null {
  if (!room.round) return null;
  const r = round(room);
  const base = {
    letter: r.letter,
    rerollsUsed: r.rerollsUsed,
    categories: r.categories,
    endMode: r.endMode,
    timerEnd: r.timerEnd,
    isFinalRound: room.roundHistory.length >= cfg(room).rounds,
  };
  if (room.phase === "setup") return base;
  if (room.phase === "writing") {
    return {
      ...base,
      doneCount: Object.keys(r.answers).length,
      bastaBy: r.bastaBy,
    };
  }
  if (room.phase === "review" || room.phase === "result") {
    return {
      ...base,
      answers: r.answers,
      marks: r.marks,
      reviewConfirmed: r.reviewConfirmed,
      pointsByPlayer: r.pointsByPlayer,
      breakdown: r.breakdown,
    };
  }
  return base;
}

function getPrivateView(room: Room, playerId: string): Record<string, unknown> | null {
  if (!room.round || room.phase !== "writing") return null;
  return { myAnswers: round(room).answers[playerId] || {} };
}

const engine: GameEngine = {
  id: "tutifruti",
  minPlayers: MIN_PLAYERS,
  createConfig,
  startRound,
  maybeAdvance,
  forceReadyAndAdvance,
  handleAction,
  getPublicRoundView,
  getPrivateView,
  getPhaseTimerEnd,
};

module.exports = engine;
