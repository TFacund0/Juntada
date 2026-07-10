// ─── Impostor Game Engine ────────────────────────────────────────────────────
// Implements the game-engine contract described in src/games/registry.js.
// Owns everything specific to "who is the impostor": categories, word
// assignment, clues, voting and the impostor reveal. Knows nothing about
// WebSocket transport or generic room/player bookkeeping.

const { CATEGORIES } = require("@juntada/impostor-data");
const { shuffle } = require("../../utils/shuffle");
const { timers } = require("../../state/roomStore");

function createConfig() {
  return {
    enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: true }), {}),
    numImpostors: 1,
    hintsEnabled: true,
    clueTime: 90, // seconds, 0 = unlimited
  };
}

function startRound(room) {
  const activeCats = Object.keys(room.config.enabledCategories).filter(k => room.config.enabledCategories[k]);
  if (activeCats.length === 0) return { error: "No hay categorías activas" };
  const catKey = activeCats[Math.floor(Math.random() * activeCats.length)];
  const cat = CATEGORIES[catKey];
  const used = room.usedWords[catKey] || [];
  const available = cat.words.filter(w => !used.includes(w));
  if (available.length === 0) return { error: `Sin palabras en ${cat.label}` };

  const word = available[Math.floor(Math.random() * available.length)];
  room.usedWords[catKey] = [...used, word];

  const playerIds = shuffle(room.players.map(p => p.id));
  const impostorCount = Math.min(room.config.numImpostors, Math.floor(room.players.length / 2));
  const impostors = playerIds.slice(0, impostorCount);

  const timerEnd = room.config.clueTime > 0
    ? Date.now() + room.config.clueTime * 1000
    : null;

  room.round = {
    word, categoryKey: catKey,
    categoryLabel: cat.label,
    categoryIcon: cat.icon,
    impostors,
    clues: {},   // playerId -> clueText
    votes: {},   // voterId -> suspectId
    eliminated: null,
    revealed: false,
    timerEnd,
  };
  room.phase = "round";
  room.players.forEach(p => { p.ready = false; });

  return { success: true };
}

function tallyVotes(room) {
  const tally = {};
  room.players.forEach(p => { tally[p.id] = 0; });
  Object.values(room.round.votes).forEach(id => { tally[id] = (tally[id] || 0) + 1; });
  const maxVotes = Math.max(...Object.values(tally));
  const topVoted = Object.entries(tally).filter(([, v]) => v === maxVotes).map(([id]) => id);
  const eliminatedId = topVoted[Math.floor(Math.random() * topVoted.length)];
  const wasImpostor = room.round.impostors.includes(eliminatedId);
  room.round.eliminated = eliminatedId;
  room.round.revealed = true;
  room.round.tally = tally;
  room.round.wasImpostor = wasImpostor;
  room.phase = "result";
  room.roundHistory.push({
    word: room.round.word,
    categoryLabel: room.round.categoryLabel,
    categoryIcon: room.round.categoryIcon,
    impostors: room.round.impostors,
    eliminated: eliminatedId,
    wasImpostor,
    tally,
  });
}

// Re-checks whether the round/voting phase can advance now that a player's
// ready/vote status or online status changed.
function maybeAdvance(room) {
  if (!room?.round) return;
  const online = room.players.filter(p => p.online);
  if (online.length === 0) return;
  if (room.phase === "round" && online.every(p => p.ready)) {
    room.phase = "voting";
    const t = timers.get(room.code);
    if (t) { clearTimeout(t); timers.delete(room.code); }
  } else if (room.phase === "voting") {
    const votedCount = online.filter(p => room.round.votes[p.id] != null).length;
    if (votedCount >= online.length) {
      tallyVotes(room);
    }
  }
}

function handleAction(room, playerId, action, payload) {
  if (!room.round) return false;
  switch (action) {
    case "submit_clue":
      if (room.phase !== "round") return false;
      room.round.clues[playerId] = payload.clue || "";
      return true;
    case "player_ready": {
      const p = room.players.find(p => p.id === playerId);
      if (p) p.ready = true;
      maybeAdvance(room);
      return true;
    }
    case "vote":
      if (room.phase !== "voting") return false;
      room.round.votes[playerId] = payload.suspectId;
      maybeAdvance(room);
      return true;
    default:
      return false;
  }
}

function getPublicRoundView(room) {
  if (!room.round) return null;
  return {
    categoryLabel: room.round.categoryLabel,
    categoryIcon: room.round.categoryIcon,
    impostorCount: room.round.impostors.length,
    timerEnd: room.round.timerEnd,
    clues: room.round.clues,
    votes: room.round.votes,
    eliminated: room.round.eliminated,
    revealed: room.round.revealed,
    wasImpostor: room.round.wasImpostor,
    tally: room.round.tally,
    impostors: room.round.revealed ? room.round.impostors : undefined,
  };
}

function getPrivateView(room, playerId) {
  const round = room.round;
  if (!round) return null;
  const isImpostor = round.impostors.includes(playerId);
  return {
    isImpostor,
    word: isImpostor ? null : round.word,
    hint: isImpostor && room.config.hintsEnabled
      ? `La categoría es ${round.categoryLabel}, pero no sabés cuál es la palabra exacta.`
      : null,
  };
}

// Extra broadcast fired the moment a round resolves, so every screen can show
// the reveal even if the "result" state's round object gets replaced later.
function getRevealMessage(room) {
  if (!room.round) return null;
  return { type: "word_reveal", word: room.round.word, categoryLabel: room.round.categoryLabel };
}

module.exports = {
  id: "impostor",
  createConfig,
  startRound,
  maybeAdvance,
  handleAction,
  getPublicRoundView,
  getPrivateView,
  getRevealMessage,
};
