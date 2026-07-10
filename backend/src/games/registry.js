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
//                         Returns true if the action was recognized and applied.
//   getPublicRoundView(room) -> plain object with the subset of round state that
//                         is safe to broadcast to every player.
//   getPrivateView(room, playerId) -> plain object with player-specific hidden
//                         info (e.g. secret word/role), or null if nothing to send.
//
// Generic room concerns (players, host, connect/kick/config) live in
// src/rooms/roomService.js and never need to change when a new game is added.

const impostorEngine = require("./impostor/engine");

const GAMES = {
  [impostorEngine.id]: impostorEngine,
};

function getEngine(gameType) {
  return GAMES[gameType];
}

module.exports = { GAMES, getEngine };
