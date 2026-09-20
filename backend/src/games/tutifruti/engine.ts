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

const { DEFAULT_CATEGORIES, LETTERS, COMMON_LETTERS } = require("@juntada/tutifruti-data") as {
  DEFAULT_CATEGORIES: Category[];
  LETTERS: string[];
  COMMON_LETTERS: string[];
};
const { normalizeWord, startsWithLetter } = require("@juntada/tutifruti-words") as typeof import("@juntada/tutifruti-words");
const { shuffle } = require("@juntada/core-utils") as { shuffle: <T>(arr: readonly T[]) => T[] };

const MIN_PLAYERS = 2;

// The writing phase has always had a timer (or "basta"), but review had
// none at all — one player alt-tabbing, forgetting, or dropping without
// their client ever flipping `online: false` left everyone else stuck
// waiting on a confirm that might never come. Fixed rather than
// host-configurable — reviewing every category for every player can take a
// while with a full table, so this leans generous rather than rushing it.
const REVIEW_TIME_MS = 180 * 1000;

// The round can end while a player is mid-keystroke: writing debounces each
// category 400ms before actually sending it (see WritingPhase.tsx), and the
// round can end at any moment neither of them controls — someone else calls
// "¡Basta!", or the timer just runs out. The frontend already flushes
// whatever's still pending the instant it notices the round ended (its
// WritingPhase unmount effect), but without this grace window the backend
// rejected that flush outright because `room.phase` had already moved to
// "review" — silently dropping the very last word someone typed. Short
// enough that nobody's meaningfully still typing once it closes, long
// enough to cover the debounce delay plus a normal round-trip.
const WRITING_GRACE_MS = 1500;

interface TutifrutiConfig {
  score: Record<string, number>;
  rounds: number;
  endMode: "timer" | "basta";
  roundTime: number;
  activeCategories: Record<string, boolean>;
  customCategories: Category[];
  enabledLetters: Record<string, boolean>;
  // Modo rápido: en vez de elegir categorías a mano, cada ronda sortea
  // `randomCategoryCount` categorías de entre todas las disponibles (ver
  // pickRoundCategories). No pisa `activeCategories` — el host puede
  // volver a "elegir a mano" sin perder lo que ya había tildado.
  randomCategoryMode: boolean;
  randomCategoryCount: number;
  // Revela el autor de cada palabra durante la revisión — apagado por
  // defecto porque la anonimidad (ver comentario en ReviewPhase.tsx del
  // frontend) es el comportamiento original; esto es un opt-in del host.
  showAuthor: boolean;
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
  reviewEnd: number | null;
  // Set the instant the round leaves "writing" (see enterReview) — submit_
  // answers stays accepted until this passes, even though room.phase is
  // already "review". See WRITING_GRACE_MS.
  writingGraceEnd: number | null;
  bastaBy: string | null;
  answers: Record<string, Record<string, string>>;
  marks: Record<string, Record<string, Record<string, boolean>>>;
  pointsByPlayer: Record<string, number> | null;
  breakdown: Record<string, Record<string, AnswerBreakdown>> | null;
  reviewConfirmed?: Record<string, boolean>;
  // Who was actually in the room when this round started — scoring and
  // duplicate detection stay pinned to this list for the whole round, not
  // the live room.players, so a player leaving mid-round can't quietly drop
  // their word out of the duplicate count and inflate someone else's score.
  participantIds: string[];
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
    endMode: "basta", // "timer" | "basta"
    roundTime: 90, // seconds, used when endMode === "timer"
    activeCategories: DEFAULT_CATEGORIES.reduce((a, c) => ({ ...a, [c.id]: false }), {} as Record<string, boolean>),
    customCategories: [], // [{ id, label }]
    enabledLetters: LETTERS.reduce((a, l) => ({ ...a, [l]: COMMON_LETTERS.includes(l) }), {} as Record<string, boolean>),
    randomCategoryMode: false,
    randomCategoryCount: 6,
    showAuthor: false,
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

// Categorías realmente usadas para la próxima ronda — en modo aleatorio
// (randomCategoryMode) ignora los toggles manuales y sortea
// randomCategoryCount categorías de entre TODAS las disponibles (default +
// custom), en vez de la selección a mano de activeCategories.
//
// Las custom van garantizadas primero (hasta llenar el cupo) y el resto se
// completa con default — un sorteo parejo sobre TODO el pool (100+ default
// vs. unas pocas custom) casi nunca tocaba una custom con el count chico por
// defecto (6), así que agregarlas se sentía como si no hicieran nada. El
// usuario las agrega a propósito para que entren a jugar, no para que
// compitan en igualdad de probabilidad contra un pool cien veces más grande.
function pickRoundCategories(room: Room): Category[] {
  if (!cfg(room).randomCategoryMode) return activeCategories(room);
  const custom = Array.isArray(cfg(room).customCategories) ? cfg(room).customCategories.filter(c => c && c.id && c.label) : [];
  const pool = [...DEFAULT_CATEGORIES, ...custom];
  if (pool.length === 0) return [];
  const count = Math.max(1, Math.min(Number(cfg(room).randomCategoryCount) || pool.length, pool.length));
  const guaranteedCustom = shuffle(custom).slice(0, count);
  const filler = shuffle(DEFAULT_CATEGORIES).slice(0, count - guaranteedCustom.length);
  return shuffle([...guaranteedCustom, ...filler]);
}

// Same "malformed config can't crash the server" guard as activeCategories.
function activeLetters(room: Room): string[] {
  const enabled = cfg(room).enabledLetters;
  if (!enabled || typeof enabled !== "object") return [];
  return LETTERS.filter(l => enabled[l]);
}

// `exclude` keeps a reroll from landing back on the exact letter already on
// screen — without it, "🔀 Cambiar letra" could silently pick the same
// letter again and increment rerollsUsed with nothing actually changing.
// Restricted to the host's enabled letters (see activeLetters) — startRound
// already refuses to begin with none active, so `pool` is never empty here.
function pickLetter(room: Room, exclude?: string): string {
  const pool = activeLetters(room);
  const used = (room.usedWords.letters as string[] | undefined) || [];
  let available = pool.filter(l => !used.includes(l) && l !== exclude);
  if (available.length === 0) {
    available = pool.filter(l => l !== exclude);
    if (available.length === 0) available = pool;
    room.usedWords.letters = [];
  }
  return available[Math.floor(Math.random() * available.length)];
}

function startRound(room: Room): { success?: true; error?: string } {
  if (room.players.length < MIN_PLAYERS) return { error: `Se necesitan al menos ${MIN_PLAYERS} jugadores` };
  if (room.roundHistory.length >= cfg(room).rounds) {
    return { error: "Ya se jugaron todas las rondas configuradas" };
  }
  const cats = pickRoundCategories(room);
  if (cats.length === 0) return { error: "No hay categorías activas" };
  if (activeLetters(room).length === 0) return { error: "No hay letras activas" };

  room.round = {
    letter: pickLetter(room),
    rerollsUsed: 0,
    categories: cats,
    endMode: cfg(room).endMode === "basta" ? "basta" : "timer",
    timerEnd: null,
    reviewEnd: null,
    writingGraceEnd: null,
    bastaBy: null,
    answers: {},
    marks: {},
    pointsByPlayer: null,
    breakdown: null,
    participantIds: room.players.map(p => p.id),
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
  r.writingGraceEnd = Date.now() + WRITING_GRACE_MS;
  r.marks = {};
  r.reviewConfirmed = {};
  r.reviewEnd = Date.now() + REVIEW_TIME_MS;
  room.players.forEach(p => {
    r.marks[p.id] = {};
  });
}

function finishRound(room: Room): void {
  const r = round(room);
  // Pinned to whoever was actually here when the round started — not the
  // live room.players — so a player leaving between writing and review
  // can't drop their word out of the duplicate count and inflate whoever
  // else wrote the same thing.
  const participantIds = r.participantIds;
  const breakdown: Record<string, Record<string, AnswerBreakdown>> = {};
  const pointsByPlayer: Record<string, number> = {};

  participantIds.forEach(pid => {
    breakdown[pid] = {};
    pointsByPlayer[pid] = 0;
  });

  r.categories.forEach(cat => {
    // Normalized word -> list of playerIds that wrote it, to detect duplicates.
    const wordsByPlayer: Record<string, string> = {};
    participantIds.forEach(pid => {
      const raw = (r.answers[pid] || {})[cat.id] || "";
      wordsByPlayer[pid] = raw.trim();
    });
    const normalizedCounts: Record<string, number> = {};
    participantIds.forEach(pid => {
      const norm = normalizeWord(wordsByPlayer[pid]);
      if (!norm) return;
      normalizedCounts[norm] = (normalizedCounts[norm] || 0) + 1;
    });

    const catBreakdown: Record<string, Omit<AnswerBreakdown, "points">> = {};
    participantIds.forEach(pid => {
      const word = wordsByPlayer[pid];
      if (!word) {
        catBreakdown[pid] = { word: "", valid: false, wrongLetter: false, duplicate: false, ticks: 0, crosses: 0 };
        return;
      }
      const marksForWord = (r.marks[pid] || {})[cat.id] || {};
      const values = Object.values(marksForWord);
      const ticks = values.filter(v => v === true).length;
      const crosses = values.filter(v => v === false).length;
      // A word that doesn't even start with the round's letter is invalid
      // no matter how anyone voted — no amount of ticks saves it.
      const wrongLetter = !startsWithLetter(word, r.letter);
      // No votes at all defaults to valid; otherwise invalid votes tying or
      // outnumbering valid ones (half or majority invalid) rejects the word.
      const noVotes = ticks + crosses === 0;
      const valid = !wrongLetter && (noVotes || ticks > crosses);
      const duplicate = valid && normalizedCounts[normalizeWord(word)] > 1;
      catBreakdown[pid] = { word, valid, wrongLetter, duplicate, ticks, crosses };
    });

    // A category where exactly one player landed a valid word is worth a
    // bonus — being the only one to nail it beats splitting points with dupes.
    const validCount = participantIds.filter(pid => catBreakdown[pid].valid).length;

    participantIds.forEach(pid => {
      const b = catBreakdown[pid];
      const points = !b.valid ? 0 : validCount === 1 ? 20 : b.duplicate ? 5 : 10;
      breakdown[pid][cat.id] = { ...b, points };
      pointsByPlayer[pid] += points;
    });
  });

  // Still credited even if they've since left — cfg(room).score is keyed by
  // playerId and simply won't be shown to anyone no longer in room.players,
  // same as it already worked before this round ever needed a snapshot.
  participantIds.forEach(pid => {
    cfg(room).score[pid] = (cfg(room).score[pid] || 0) + pointsByPlayer[pid];
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
  if (room.phase === "writing") {
    enterReview(room);
  } else if (room.phase === "review") {
    // Review's own timer ran out — treat it as if every online player had
    // just confirmed, same as writing's timer treats a timeout as everyone
    // being ready. Whoever's genuinely still deciding loses that vote, but
    // the alternative is the round staying stuck forever on one straggler.
    const r = round(room);
    if (!r.reviewConfirmed) r.reviewConfirmed = {};
    room.players.forEach(p => {
      if (p.online) r.reviewConfirmed![p.id] = true;
    });
    finishRound(room);
  }
}

function resetProgress(room: Room): void {
  cfg(room).score = {};
  room.roundHistory.length = 0;
}

function getPhaseTimerEnd(room: Room): number | null {
  if (room.phase === "writing" && round(room)?.endMode === "timer") return round(room).timerEnd;
  if (room.phase === "review") return round(room)?.reviewEnd ?? null;
  return null;
}

function handleAction(room: Room, playerId: string, action: string, payload: Record<string, unknown>): { handled: boolean } {
  if (!room.round) return { handled: false };
  const r = round(room);

  switch (action) {
    // Once every configured round has been played, startRound refuses
    // forever (room.roundHistory never shrinks on its own — not even
    // "Volver al lobby" clears it) — this is the only way to actually start
    // a fresh match in the same room afterwards. Unlike sintonia's own
    // new_game (which restarts play immediately), this sends everyone back
    // to the lobby so the host can reconfigure (categories, rounds, etc.)
    // before the next match instead of reusing whatever was set last time.
    case "new_game": {
      if (playerId !== room.hostId) return { handled: false };
      resetProgress(room);
      room.round = null;
      room.phase = "lobby";
      room.players.forEach(p => {
        p.ready = false;
      });
      return { handled: true };
    }

    case "confirm_letter": {
      if (room.phase !== "setup") return { handled: false };
      if (playerId !== room.hostId) return { handled: false };
      if (payload?.reroll) {
        r.letter = pickLetter(room, r.letter);
        r.rerollsUsed += 1;
        return { handled: true };
      }
      room.phase = "writing";
      r.timerEnd = r.endMode === "timer" ? Date.now() + cfg(room).roundTime * 1000 : null;
      return { handled: true };
    }

    case "submit_answers": {
      // Still accepted a moment into "review" — see WRITING_GRACE_MS — so
      // the flush a client fires the instant it notices the round ended
      // (someone else called "¡Basta!", or the timer ran out) isn't
      // rejected just because room.phase already flipped by the time it
      // arrives. Closed for good once the grace window passes.
      const inWritingGrace = room.phase === "review" && !!r.writingGraceEnd && Date.now() < r.writingGraceEnd;
      if (room.phase !== "writing" && !inWritingGrace) return { handled: false };
      // Marking "Ya terminé" (player_ready) locks in whatever's already
      // there — accepting further edits after that would let a client keep
      // typing behind the "esperando a los demás" message everyone else
      // sees, effectively getting extra time nobody agreed to.
      if (room.players.find(p => p.id === playerId)?.ready) return { handled: false };
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
      // Locked once this voter has confirmed their scores — otherwise a
      // vote cast after confirming could shift the tally out from under
      // players who already confirmed based on the marks they saw at the
      // time, even though "Confirmaste los puntajes" implies finality.
      if (r.reviewConfirmed?.[playerId]) return { handled: false };
      const targetPlayerId = payload?.targetPlayerId as string;
      const categoryId = payload?.categoryId as string;
      const valid = payload?.valid;
      if (typeof valid !== "boolean") return { handled: false };
      if (!r.categories.some(c => c.id === categoryId)) return { handled: false };
      // Checked against this round's participant snapshot, not the live
      // roster — a player who's since left the room can still have their
      // word voted on by whoever's left, instead of it being stuck unmarked.
      if (!r.participantIds.includes(targetPlayerId)) return { handled: false };
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
  const isFinalRound = room.roundHistory.length >= cfg(room).rounds;
  // In every phase but "result" the current round hasn't been pushed to
  // roundHistory yet, so its number is one past what's already completed.
  const roundNumber = room.phase === "result" ? room.roundHistory.length : room.roundHistory.length + 1;
  const base = {
    letter: r.letter,
    rerollsUsed: r.rerollsUsed,
    categories: r.categories,
    endMode: r.endMode,
    timerEnd: r.timerEnd,
    isFinalRound,
    roundNumber,
    totalRounds: cfg(room).rounds,
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
      reviewEnd: r.reviewEnd,
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
  resetProgress,
};

module.exports = engine;
