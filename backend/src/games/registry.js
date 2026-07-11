// ─── Game Registry ───────────────────────────────────────────────────────────
// Every game plugged into Juntada implements this contract:
//
//   id               string, matches the key used here and room.gameType
//   createConfig()   -> default per-room config object for this game
//   startRound(room) -> mutates room.round/room.phase, returns { success } | { error }
//   maybeAdvance(room) -> re-checks ready/vote-style completion, called after any
//                         player action changes and after online/offline changes.
//                         Mutates room.phase/room.round as needed.
//   handleAction(room, playerId, action, payload) -> mutates round state for a
//                         game-specific action (e.g. "submit_clue", "vote").
//                         Returns { handled, ...extra } — see submit_clue vs.
//                         skip_word in the impostor engine for the "extra"
//                         flags a transport-layer handler might react to.
//   getPublicRoundView(room) -> plain object with the subset of round state that
//                         is safe to broadcast to every player.
//   getPrivateView(room, playerId) -> plain object with player-specific hidden
//                         info (e.g. secret word/role), or null if nothing to send.
//
// Optional, for games with a timed phase that should auto-advance:
//   getPhaseTimerEnd(room) -> timestamp (ms) the current phase should end at
//                         on its own, or null if nothing is scheduled.
//   forceReadyAndAdvance(room) -> called when that timer fires; should act as
//                         if every online player just signaled "ready" and
//                         let maybeAdvance take it from there.
//
// Generic room concerns (players, host, connect/kick/config) live in
// src/rooms/roomService.js and never need to change when a new game is added.

const impostorEngine = require("./impostor/engine");
const torneoFifaEngine = require("./torneo-fifa/engine");
const tatetiEngine = require("./tateti/engine");
const sintoniaEngine = require("./sintonia/engine");
const limonLimonEngine = require("./limon-limon/engine");
const tutifrutiEngine = require("./tutifruti/engine");

const GAMES = {
  [impostorEngine.id]: impostorEngine,
  [torneoFifaEngine.id]: torneoFifaEngine,
  [tatetiEngine.id]: tatetiEngine,
  [sintoniaEngine.id]: sintoniaEngine,
  [limonLimonEngine.id]: limonLimonEngine,
  [tutifrutiEngine.id]: tutifrutiEngine,
};

function getEngine(gameType) {
  return GAMES[gameType];
}

module.exports = { GAMES, getEngine };
