// ─── WS Messaging Helpers ──────────────────────────────────────────────────────
// Low-level send/broadcast primitives plus the public/private view builders.
// The room-level fields here are generic; anything about "what's happening
// in this round" is delegated to the room's game engine.

const { WebSocket } = require("ws");
const { rooms, clients } = require("../state/roomStore");
const { getEngine } = require("../games/registry");

function sendTo(ws, message) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function broadcast(roomCode, message, excludeWs = null) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const data = JSON.stringify(message);
  for (const [ws, info] of clients) {
    if (info.roomCode === roomCode && ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

function getRoomPublicState(room) {
  const engine = getEngine(room.gameType);
  return {
    code: room.code,
    name: room.name,
    hostId: room.hostId,
    gameType: room.gameType,
    phase: room.phase,
    players: room.players.map(p => ({
      id: p.id, name: p.name, ready: p.ready,
      online: p.online, hasVoted: !!room.round?.votes?.[p.id],
    })),
    config: room.config,
    round: engine?.getPublicRoundView(room) ?? null,
    usedWords: room.usedWords,
    roundHistory: room.roundHistory,
  };
}

function sendPrivateInfo(ws, room, playerId) {
  const engine = getEngine(room.gameType);
  const view = engine?.getPrivateView(room, playerId);
  if (!view) return;
  sendTo(ws, { type: "private_role", ...view });
}

function broadcastState(room) {
  broadcast(room.code, { type: "state", room: getRoomPublicState(room) });
}

function broadcastRoundReveal(room) {
  const engine = getEngine(room.gameType);
  const message = engine?.getRevealMessage(room);
  if (message) broadcast(room.code, message);
}

module.exports = {
  sendTo,
  broadcast,
  getRoomPublicState,
  sendPrivateInfo,
  broadcastState,
  broadcastRoundReveal,
};
