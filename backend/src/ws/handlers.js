// ─── WS Message Handlers ────────────────────────────────────────────────────
// One function per message type. Handlers only orchestrate: generic room
// concerns go through roomService, game-specific rules go through the
// engine registered for the room's gameType. No game rules live here.

const { WebSocket } = require("ws");
const { rooms, clients, timers } = require("../state/roomStore");
const { getEngine } = require("../games/registry");
const roomService = require("../rooms/roomService");
const { sendTo, broadcast, getRoomPublicState, sendPrivateInfo, broadcastState, broadcastRoundReveal } = require("./messaging");

function stopTimer(roomCode) {
  const t = timers.get(roomCode);
  if (t) { clearTimeout(t); timers.delete(roomCode); }
}

// Re-derives whatever timer the room's current phase needs (if any) from the
// engine and (re)schedules it, replacing any previous one. Safe to call after
// every state-mutating action — cheap, and idempotent when nothing changed.
// When the scheduled timer fires, it's as if every online player pressed
// "ready": the engine decides where that leads, we just broadcast the result
// and immediately re-sync in case that opened up a next phase's timer.
function syncPhaseTimer(room) {
  stopTimer(room.code);
  const engine = getEngine(room.gameType);
  const endsAt = engine.getPhaseTimerEnd?.(room);
  if (!endsAt) return;

  const expectedPhase = room.phase;
  const delay = endsAt - Date.now();
  if (delay <= 0) return;

  const t = setTimeout(() => {
    const r = rooms.get(room.code);
    if (!r || r.phase !== expectedPhase) return;
    const eng = getEngine(r.gameType);
    eng.forceReadyAndAdvance?.(r);
    broadcastToRoom(r, (ws2, i2) => {
      sendTo(ws2, { type: "state", room: getRoomPublicState(r) });
    });
    if (r.phase === "result") broadcastRoundReveal(r);
    syncPhaseTimer(r);
  }, delay);
  timers.set(room.code, t);
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
  const engine = getEngine(room.gameType);
  const minPlayers = engine.minPlayers ?? 2;
  if (room.players.length < minPlayers) { sendTo(ws, { type: "error", message: `Necesitás al menos ${minPlayers} jugadores` }); return; }
  const res = engine.startRound(room);
  if (res.error) { sendTo(ws, { type: "error", message: res.error }); return; }
  broadcastToRoom(room, (ws2, i2) => {
    sendTo(ws2, { type: "state", room: getRoomPublicState(room) });
    sendPrivateInfo(ws2, room, i2.playerId);
  });
  syncPhaseTimer(room);
}

// Generic entry point for any in-round player action (clue, ready, vote,
// skip_word, ...). The specific action names/payloads are entirely defined
// by the game engine — this stays game-agnostic. A "rerolled" result means
// the engine changed the round's private info (e.g. a new secret word), so
// every player needs a fresh private_role message, not just the public state.
function gameAction(actionType) {
  return (ws, msg, info) => {
    const room = rooms.get(info.roomCode);
    if (!room) return;
    const engine = getEngine(room.gameType);
    const result = engine.handleAction(room, info.playerId, actionType, msg);
    if (!result?.handled) { sendTo(ws, { type: "error", message: "Esa acción no es válida ahora" }); return; }

    if (result.rerolled) {
      broadcastToRoom(room, (ws2, i2) => {
        sendTo(ws2, { type: "state", room: getRoomPublicState(room) });
        sendPrivateInfo(ws2, room, i2.playerId);
      });
    } else {
      broadcastState(room);
    }
    if (room.phase === "result") broadcastRoundReveal(room);
    syncPhaseTimer(room);
  };
}

function backToLobby(ws, msg, info) {
  const room = rooms.get(info.roomCode);
  if (!room || room.hostId !== info.playerId) return;
  stopTimer(room.code);
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
      if (room.round) syncPhaseTimer(room);
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
  skip_word: gameAction("skip_word"),
  submit_guess: gameAction("submit_guess"),
  confirm_round_setup: gameAction("confirm_round_setup"),
  report_result: gameAction("report_result"),
  mark: gameAction("mark"),
  reset_score_vote: gameAction("reset_score_vote"),
  back_to_lobby: backToLobby,
  kick_player: kickPlayer,
  ping: (ws) => ping(ws),
};

module.exports = { HANDLERS, handleDisconnect };
