// ─── Tutifrutti Game Engine ──────────────────────────────────────────────────
// Implements the game-engine contract described in src/games/registry.js.
// Stop/Basta: a letter is drawn, everyone fills a shared list of categories
// with a word starting with that letter, then the group marks each answer
// valid/invalid before points are tallied.
//
// Phases: setup (letter drawn, host can reroll) -> writing (everyone fills
// categories, ends by timer or "basta") -> review (mark valid/invalid) ->
// result (points for the round + running standings).

const { DEFAULT_CATEGORIES, LETTERS } = require("@juntada/tutifruti-data");

const MIN_PLAYERS = 2;

function createConfig() {
  return {
    score: {},
    rounds: 5,
    endMode: "timer", // "timer" | "basta"
    roundTime: 90,    // seconds, used when endMode === "timer"
    activeCategories: DEFAULT_CATEGORIES.reduce((a, c) => ({ ...a, [c.id]: true }), {}),
    customCategories: [], // [{ id, label }]
  };
}

// A malformed update_config shouldn't be able to crash the server — anything
// that doesn't look like real config data is ignored.
function activeCategories(room) {
  const enabled = room.config.activeCategories;
  const defaults = DEFAULT_CATEGORIES.filter(c => enabled && typeof enabled === "object" && enabled[c.id]);
  const custom = Array.isArray(room.config.customCategories) ? room.config.customCategories : [];
  return [...defaults, ...custom.filter(c => c && c.id && c.label)];
}

function normalizeWord(word) {
  return (word || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function pickLetter(room) {
  const used = room.usedWords.letters || [];
  let available = LETTERS.filter(l => !used.includes(l));
  if (available.length === 0) { room.usedWords.letters = []; available = LETTERS; }
  const letter = available[Math.floor(Math.random() * available.length)];
  return letter;
}

function startRound(room) {
  if (room.players.length < MIN_PLAYERS) return { error: `Se necesitan al menos ${MIN_PLAYERS} jugadores` };
  if (room.roundHistory.length >= room.config.rounds) {
    return { error: "Ya se jugaron todas las rondas configuradas" };
  }
  const cats = activeCategories(room);
  if (cats.length === 0) return { error: "No hay categorías activas" };

  room.round = {
    letter: pickLetter(room),
    rerollsUsed: 0,
    categories: cats,
    endMode: room.config.endMode === "basta" ? "basta" : "timer",
    timerEnd: null,
    bastaBy: null,
    answers: {},
    marks: {},
    pointsByPlayer: null,
    breakdown: null,
  };
  room.phase = "setup";
  room.players.forEach(p => { p.ready = false; });
  return { success: true };
}

function enterReview(room) {
  room.phase = "review";
  room.round.marks = {};
  room.players.forEach(p => { room.round.marks[p.id] = {}; });
}

function finishRound(room) {
  const round = room.round;
  const players = room.players;
  const breakdown = {};
  const pointsByPlayer = {};

  players.forEach(p => { breakdown[p.id] = {}; pointsByPlayer[p.id] = 0; });

  round.categories.forEach(cat => {
    // Normalized word -> list of playerIds that wrote it, to detect duplicates.
    const wordsByPlayer = {};
    players.forEach(p => {
      const raw = (round.answers[p.id] || {})[cat.id] || "";
      wordsByPlayer[p.id] = raw.trim();
    });
    const normalizedCounts = {};
    players.forEach(p => {
      const norm = normalizeWord(wordsByPlayer[p.id]);
      if (!norm) return;
      normalizedCounts[norm] = (normalizedCounts[norm] || 0) + 1;
    });

    players.forEach(p => {
      const word = wordsByPlayer[p.id];
      if (!word) {
        breakdown[p.id][cat.id] = { word: "", valid: false, duplicate: false, points: 0, ticks: 0, crosses: 0 };
        return;
      }
      const marksForWord = (round.marks[p.id] || {})[cat.id] || {};
      const values = Object.values(marksForWord);
      const ticks = values.filter(v => v === true).length;
      const crosses = values.filter(v => v === false).length;
      const valid = crosses <= ticks;
      const duplicate = valid && normalizedCounts[normalizeWord(word)] > 1;
      const points = !valid ? 0 : duplicate ? 5 : 10;
      breakdown[p.id][cat.id] = { word, valid, duplicate, points, ticks, crosses };
      pointsByPlayer[p.id] += points;
    });
  });

  players.forEach(p => {
    room.config.score[p.id] = (room.config.score[p.id] || 0) + pointsByPlayer[p.id];
  });

  round.pointsByPlayer = pointsByPlayer;
  round.breakdown = breakdown;
  room.phase = "result";
  room.roundHistory.push({
    letter: round.letter,
    categories: round.categories,
    pointsByPlayer,
    breakdown,
  });
  room.usedWords.letters = [...(room.usedWords.letters || []), round.letter];
}

function maybeAdvance() {
  // Writing ends only via timer/basta, review only via host confirm — no
  // player state change auto-advances a phase here.
}

function forceReadyAndAdvance(room) {
  if (room.phase === "writing") enterReview(room);
}

function getPhaseTimerEnd(room) {
  if (room.phase === "writing" && room.round?.endMode === "timer") return room.round.timerEnd;
  return null;
}

function handleAction(room, playerId, action, payload) {
  if (!room.round) return { handled: false };
  const round = room.round;

  switch (action) {
    case "confirm_letter": {
      if (room.phase !== "setup") return { handled: false };
      if (playerId !== room.hostId) return { handled: false };
      if (payload?.reroll) {
        round.letter = pickLetter(room);
        round.rerollsUsed += 1;
        return { handled: true };
      }
      room.phase = "writing";
      round.timerEnd = round.endMode === "timer" ? Date.now() + room.config.roundTime * 1000 : null;
      return { handled: true };
    }

    case "submit_answers": {
      if (room.phase !== "writing") return { handled: false };
      const answers = payload?.answers;
      if (!answers || typeof answers !== "object") return { handled: false };
      const validIds = new Set(round.categories.map(c => c.id));
      const current = round.answers[playerId] || {};
      const next = { ...current };
      Object.entries(answers).forEach(([catId, word]) => {
        if (validIds.has(catId) && typeof word === "string") next[catId] = word.slice(0, 60);
      });
      round.answers[playerId] = next;
      return { handled: true };
    }

    case "call_basta": {
      if (room.phase !== "writing" || round.endMode !== "basta") return { handled: false };
      round.bastaBy = playerId;
      enterReview(room);
      return { handled: true };
    }

    case "mark_word": {
      if (room.phase !== "review") return { handled: false };
      const { targetPlayerId, categoryId, valid } = payload || {};
      if (targetPlayerId === playerId) return { handled: false };
      if (typeof valid !== "boolean") return { handled: false };
      if (!round.categories.some(c => c.id === categoryId)) return { handled: false };
      if (!room.players.some(p => p.id === targetPlayerId)) return { handled: false };
      if (!(round.answers[targetPlayerId] || {})[categoryId]) return { handled: false };
      if (!round.marks[targetPlayerId]) round.marks[targetPlayerId] = {};
      if (!round.marks[targetPlayerId][categoryId]) round.marks[targetPlayerId][categoryId] = {};
      round.marks[targetPlayerId][categoryId][playerId] = valid;
      return { handled: true };
    }

    case "confirm_review": {
      if (room.phase !== "review") return { handled: false };
      if (playerId !== room.hostId) return { handled: false };
      finishRound(room);
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

function getPublicRoundView(room) {
  if (!room.round) return null;
  const round = room.round;
  const base = {
    letter: round.letter,
    rerollsUsed: round.rerollsUsed,
    categories: round.categories,
    endMode: round.endMode,
    timerEnd: round.timerEnd,
    isFinalRound: room.roundHistory.length >= room.config.rounds,
  };
  if (room.phase === "setup") return base;
  if (room.phase === "writing") {
    return {
      ...base,
      doneCount: Object.keys(round.answers).length,
      bastaBy: round.bastaBy,
    };
  }
  if (room.phase === "review" || room.phase === "result") {
    return {
      ...base,
      answers: round.answers,
      marks: round.marks,
      pointsByPlayer: round.pointsByPlayer,
      breakdown: round.breakdown,
    };
  }
  return base;
}

function getPrivateView(room, playerId) {
  const round = room.round;
  if (!round || room.phase !== "writing") return null;
  return { myAnswers: round.answers[playerId] || {} };
}

module.exports = {
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
