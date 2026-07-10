// ─── State ────────────────────────────────────────────────────────────────────
// In-memory store for rooms, connected clients and pending round timers.
// Kept isolated so the WS transport layer never touches raw Maps directly.

const rooms = new Map();    // roomCode -> roomState
const clients = new Map();  // ws -> { roomCode, playerId }
const timers = new Map();   // roomCode -> Timeout

module.exports = { rooms, clients, timers };
