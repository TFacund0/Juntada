// ─── WS Message Handlers ────────────────────────────────────────────────────
// One function per message type. Handlers only orchestrate: generic room
// concerns go through roomService, game-specific rules go through the
// engine registered for the room's gameType. No game rules live here.

const { WebSocket } = require("ws");
const { rooms, clients, timers } = require("../state/roomStore");
const { getEngine } = require("../games/registry");
const roomService = require("../rooms/roomService");
const { sendTo, broadcast, getRoomPublicState, sendPrivateInfo, broadcastState, broadcastRoundReveal } = require("./messaging");

function startTimer(roomCode) {
  const room = rooms.get(roomCode);
  if (!room?.round?.timerEnd) return;
  const delay = room.round.timerEnd - Date.now();
  if (delay <= 0) return;
  const t = setTimeout(() => {
    const r = rooms.get(roomCode);
    if (!r || r.phase !== "round") return;
    r.phase = "voting";
    broadcastState(r);
  }, delay);
  timers.set(roomCode, t);
}

function broadcastToRoom(room, message) {
  for (const [ws2, i2] of clients) {
    if (i2.roomCode === room.code && ws2.readyState === WebSocket.OPEN) message(ws2, i2);
  }
}

function createRoom(ws, msg) {
  const { room, error } = roomService.createRoom(ws, {
    playerName: msg.playerName,
    roomName: msg.roomName,
    gameType: msg.gameType,
  });
  if (error) { sendTo(ws, { type: "error", message: error }); return; }
  sendTo(ws, { type: "joined", playerId: room.hostId, roomCode: room.code, room: getRoomPublicState(room) });
}

function joinRoom(ws, msg) {
  const { room, playerId, error } = roomService.joinRoom(ws, { code: msg.code, playerName: msg.playerName });
  if (error) { sendTo(ws, { type: "error", message: error }); return; }
  sendTo(ws, { type: "joined", playerId, roomCode: room.code, room: getRoomPublicState(room) });
  if (room.round) sendPrivateInfo(ws, room, playerId);
  broadcast(room.code, { type: "state", room: getRoomPublicState(room) }, ws);
}

function rejoin(ws, msg) {
  const { room, playerId, error } = roomService.rejoinRoom(ws, { roomCode: msg.roomCode, playerId: msg.playerId });
  if (error) { sendTo(ws, { type: "error", message: error }); return; }
  sendTo(ws, { type: "joined", playerId, roomCode: room.code, room: getRoomPublicState(room) });
  if (room.round) sendPrivateInfo(ws, room, playerId);
  broadcast(room.code, { type: "state", room: getRoomPublicState(room) }, ws);
}

function updateConfig(ws, msg, info) {
  const room = rooms.get(info.roomCode);
  if (!room || room.hostId !== info.playerId) return;
  roomService.updateConfig(room, msg.config);
  broadcastState(room);
}

function startRoundHandler(ws, msg, info) {
  const room = rooms.get(info.roomCode);
  if (!room || room.hostId !== info.playerId) return;
  if (room.players.length < 2) { sendTo(ws, { type: "error", message: "Necesitás al menos 2 jugadores" }); return; }
  const engine = getEngine(room.gameType);
  const res = engine.startRound(room);
  if (res.error) { sendTo(ws, { type: "error", message: res.error }); return; }
  broadcastToRoom(room, (ws2, i2) => {
    sendTo(ws2, { type: "state", room: getRoomPublicState(room) });
    sendPrivateInfo(ws2, room, i2.playerId);
  });
  if (room.round.timerEnd) startTimer(room.code);
}

// Generic entry point for any in-round player action (clue, ready, vote, ...).
// The specific action names/payloads are entirely defined by the game engine.
function gameAction(actionType) {
  return (ws, msg, info) => {
    const room = rooms.get(info.roomCode);
    if (!room) return;
    const engine = getEngine(room.gameType);
    const handled = engine.handleAction(room, info.playerId, actionType, msg);
    if (!handled) { sendTo(ws, { type: "error", message: "Esa acción no es válida ahora" }); return; }
    broadcastState(room);
    if (room.phase === "result") broadcastRoundReveal(room);
  };
}

function backToLobby(ws, msg, info) {
  const room = rooms.get(info.roomCode);
  if (!room || room.hostId !== info.playerId) return;
  room.phase = "lobby";
  room.round = null;
  room.players.forEach(p => { p.ready = false; });
  broadcastState(room);
}

function kickPlayer(ws, msg, info) {
  const room = rooms.get(info.roomCode);
  if (!room || room.hostId !== info.playerId) return;
  roomService.kickPlayer(room, msg.targetId);
  broadcastToRoom(room, (ws2, i2) => {
    if (i2.playerId === msg.targetId) {
      sendTo(ws2, { type: "kicked" });
      clients.set(ws2, { roomCode: null, playerId: null });
    } else {
      sendTo(ws2, { type: "state", room: getRoomPublicState(room) });
    }
  });
}

function ping(ws) {
  sendTo(ws, { type: "pong" });
}

function handleDisconnect(ws) {
  const info = clients.get(ws);
  if (info?.roomCode) {
    const room = rooms.get(info.roomCode);
    if (room) {
      roomService.markOffline(room, info.playerId);
      broadcastState(room);
      if (room.phase === "result") broadcastRoundReveal(room);
      if (roomService.isRoomFullyOffline(room)) roomService.scheduleRoomCleanup(room.code);
    }
  }
  clients.delete(ws);
}

// Message type -> handler(ws, msg, info)
const HANDLERS = {
  create_room: (ws, msg) => createRoom(ws, msg),
  join_room: (ws, msg) => joinRoom(ws, msg),
  rejoin: (ws, msg) => rejoin(ws, msg),
  update_config: updateConfig,
  start_round: startRoundHandler,
  submit_clue: gameAction("submit_clue"),
  player_ready: gameAction("player_ready"),
  vote: gameAction("vote"),
  back_to_lobby: backToLobby,
  kick_player: kickPlayer,
  ping: (ws) => ping(ws),
};

module.exports = { HANDLERS, handleDisconnect };
