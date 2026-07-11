// ─── Impostor Game Engine ────────────────────────────────────────────────────
// Implements the game-engine contract described in src/games/registry.js.
// Owns everything specific to "who is the impostor": categories, word
// assignment, clues, voting and the impostor reveal. Knows nothing about
// WebSocket transport or generic room/player bookkeeping.
//
// Phases: round (see word, optionally write a clue) -> discussion (think,
// no new info; skippable early if everyone's ready) -> voting -> result.
// discussionTime = 0 skips the discussion phase entirely.

const { CATEGORIES } = require("@juntada/impostor-data");
const { shuffle } = require("../../utils/shuffle");
const { timers } = require("../../state/roomStore");

const MIN_PLAYERS = 3;
// A tie at the top keeps re-voting among just the tied suspects rather than
// eliminating one at random — but cap it so a stubborn 1-1 tie between two
// players (who can just keep voting for each other) doesn't loop forever.
const MAX_REVOTES = 2;

function createConfig() {
  return {
    enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: true }), {}),
    numImpostors: 1,
    hintsEnabled: true,
    clueTime: 90,       // seconds, 0 = unlimited
    writtenClues: false, // require typing the clue instead of just saying it out loud
    discussionTime: 30, // seconds, 0 = skip the discussion phase entirely
    discussionUnlimited: false, // discussion phase happens but with no timer/auto-advance — players mark ready manually
  };
}

// A malformed update_config (bad client, typo) shouldn't be able to crash the
// server — anything that doesn't look like a real category map is ignored.
function activeCategoryKeys(room) {
  const enabled = room.config.enabledCategories;
  if (!enabled || typeof enabled !== "object") return [];
  return Object.keys(CATEGORIES).filter(k => enabled[k]);
}

function pickWord(room, catKey, excludeWord = null) {
  const cat = CATEGORIES[catKey];
  const used = room.usedWords[catKey] || [];
  const available = cat.words.filter(w => !used.includes(w) && w !== excludeWord);
  if (available.length === 0) return null;
  const word = available[Math.floor(Math.random() * available.length)];
  room.usedWords[catKey] = [...used, word];
  return word;
}

function stopRoomTimer(room) {
  const t = timers.get(room.code);
  if (t) { clearTimeout(t); timers.delete(room.code); }
}

function startRound(room) {
  if (room.players.length < MIN_PLAYERS) return { error: `Necesitás al menos ${MIN_PLAYERS} jugadores` };

  const activeCats = activeCategoryKeys(room);
  if (activeCats.length === 0) return { error: "No hay categorías activas" };
  const catKey = activeCats[Math.floor(Math.random() * activeCats.length)];
  const cat = CATEGORIES[catKey];
  const word = pickWord(room, catKey);
  if (!word) return { error: `Sin palabras en ${cat.label}` };

  const playerIds = shuffle(room.players.map(p => p.id));
  const numImpostors = Number.isInteger(room.config.numImpostors) ? room.config.numImpostors : 1;
  const impostorCount = Math.max(1, Math.min(numImpostors, Math.floor(room.players.length / 2)));
  const impostors = playerIds.slice(0, impostorCount);

  const timerEnd = room.config.clueTime > 0
    ? Date.now() + room.config.clueTime * 1000
    : null;

  room.round = {
    word, categoryKey: catKey,
    categoryLabel: cat.label,
    categoryIcon: cat.icon,
    impostors,
    clues: {},        // playerId -> clueText
    votes: {},        // voterId -> suspectId
    skipVotes: [],     // playerIds that asked for a different word this round
    eliminated: null,
    revealed: false,
    timerEnd,
    discussionEnd: null,
    revoteCandidates: null, // set of tied playerIds when a vote must be repeated
    revoteCount: 0,
  };
  room.phase = "round";
  room.players.forEach(p => { p.ready = false; });

  return { success: true };
}

// Majority of *online* players needed to swap the current word for a new one.
function skipThreshold(room) {
  const online = room.players.filter(p => p.online).length;
  return Math.floor(online / 2) + 1;
}

// skipVotes only ever grows (see skip_word below) — if a voter is later
// kicked, their id would otherwise linger there forever, forming a phantom
// vote that counts toward a threshold now computed from a smaller player
// list. Always read the count through this filter instead of skipVotes.length.
function activeSkipVotes(room) {
  const ids = room.players.map(p => p.id);
  return room.round.skipVotes.filter(id => ids.includes(id));
}

// Swaps the word for a fresh one from the same category, keeping the same
// impostors — this is meant to feel instant, not like starting the round
// over. Only falls back to a full re-shuffle (new category, new impostors)
// if that category has no words left to offer.
function rerollWord(room) {
  const word = pickWord(room, room.round.categoryKey, room.round.word);
  if (!word) { startRound(room); return; }

  room.round.word = word;
  room.round.skipVotes = [];
  room.players.forEach(p => { p.ready = false; });
  room.round.timerEnd = room.config.clueTime > 0 ? Date.now() + room.config.clueTime * 1000 : null;
}

function tallyVotes(room) {
  const tally = {};
  room.players.forEach(p => { tally[p.id] = 0; });
  Object.values(room.round.votes).forEach(id => { tally[id] = (tally[id] || 0) + 1; });
  const maxVotes = Math.max(...Object.values(tally));
  const topVoted = Object.entries(tally).filter(([, v]) => v === maxVotes).map(([id]) => id);

  // Tie at the top: repeat the vote among just the tied suspects instead of
  // eliminating one at random, up to MAX_REVOTES times.
  if (topVoted.length > 1 && maxVotes > 0 && room.round.revoteCount < MAX_REVOTES) {
    room.round.revoteCandidates = topVoted;
    room.round.revoteCount += 1;
    room.round.votes = {};
    room.round.tally = tally;
    room.phase = "voting";
    return;
  }

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

function enterVoting(room) {
  room.phase = "voting";
  room.round.discussionEnd = null;
}

function enterDiscussionOrVoting(room) {
  stopRoomTimer(room); // clear the round's clue-timer, we're leaving that phase
  const discussionTime = Number.isFinite(room.config.discussionTime) ? room.config.discussionTime : 0;
  const unlimited = !!room.config.discussionUnlimited;
  // discussionTime === 0 without "unlimited" means the host chose to skip
  // the discussion phase entirely, straight to voting. With "unlimited" on,
  // the phase still happens but nothing forces it to end — same as clueTime
  // === 0 already does for the round phase — players advance by hand.
  if (discussionTime <= 0 && !unlimited) { enterVoting(room); return; }
  room.phase = "discussion";
  room.round.discussionEnd = unlimited ? null : Date.now() + discussionTime * 1000;
  room.players.forEach(p => { p.ready = false; });
}

// Re-checks whether the round/discussion/voting phase can advance now that a
// player's ready/vote status or online status changed.
function maybeAdvance(room) {
  if (!room?.round) return;
  const online = room.players.filter(p => p.online);
  if (online.length === 0) return;

  if (room.phase === "round" && online.every(p => p.ready)) {
    enterDiscussionOrVoting(room);
  } else if (room.phase === "discussion" && online.every(p => p.ready)) {
    stopRoomTimer(room);
    enterVoting(room);
  } else if (room.phase === "voting") {
    const votedCount = online.filter(p => room.round.votes[p.id] != null).length;
    if (votedCount >= online.length) {
      tallyVotes(room);
    }
  }
}

// Called by the transport layer when a scheduled phase timer fires: acts as
// if every online player just pressed "ready", then lets maybeAdvance decide
// where that leads (discussion, voting, or nothing yet).
function forceReadyAndAdvance(room) {
  room.players.forEach(p => { if (p.online) p.ready = true; });
  maybeAdvance(room);
}

function handleAction(room, playerId, action, payload) {
  if (!room.round) return { handled: false };
  switch (action) {
    case "submit_clue":
      if (room.phase !== "round") return { handled: false };
      room.round.clues[playerId] = (payload.clue || "").trim();
      return { handled: true };

    case "player_ready": {
      if (room.phase !== "round" && room.phase !== "discussion") return { handled: false };
      if (room.phase === "round" && room.config.writtenClues && !room.round.clues[playerId]) {
        return { handled: false };
      }
      const p = room.players.find(p => p.id === playerId);
      if (p) p.ready = true;
      maybeAdvance(room);
      return { handled: true };
    }

    case "vote": {
      if (room.phase !== "voting") return { handled: false };
      const { revoteCandidates } = room.round;
      const eligible = revoteCandidates
        ? room.players.some(p => p.id === payload.suspectId && revoteCandidates.includes(p.id))
        : room.players.some(p => p.id === payload.suspectId);
      if (!eligible) return { handled: false };
      room.round.votes[playerId] = payload.suspectId;
      maybeAdvance(room);
      return { handled: true };
    }

    case "skip_word": {
      if (room.phase !== "round") return { handled: false };
      if (!room.round.skipVotes.includes(playerId)) room.round.skipVotes.push(playerId);
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

function getPublicRoundView(room) {
  if (!room.round) return null;
  return {
    categoryLabel: room.round.categoryLabel,
    categoryIcon: room.round.categoryIcon,
    impostorCount: room.round.impostors.length,
    timerEnd: room.round.timerEnd,
    discussionEnd: room.round.discussionEnd,
    clues: room.round.clues,
    votes: room.round.votes,
    eliminated: room.round.eliminated,
    revealed: room.round.revealed,
    wasImpostor: room.round.wasImpostor,
    tally: room.round.tally,
    impostors: room.round.revealed ? room.round.impostors : undefined,
    skipVotes: activeSkipVotes(room).length,
    skipVotesNeeded: skipThreshold(room),
    revoteCandidates: room.round.revoteCandidates,
    revoteCount: room.round.revoteCount,
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

// The phase-relevant timestamp the transport layer should schedule an
// auto-advance for (see forceReadyAndAdvance), or null if none applies.
function getPhaseTimerEnd(room) {
  if (room.phase === "round") return room.round?.timerEnd ?? null;
  if (room.phase === "discussion") return room.round?.discussionEnd ?? null;
  return null;
}

module.exports = {
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
