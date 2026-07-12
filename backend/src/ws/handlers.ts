// ─── WS Message Handlers ────────────────────────────────────────────────────
// One function per message type. Handlers only orchestrate: generic room
// concerns go through roomService, game-specific rules go through the
// engine registered for the room's gameType. No game rules live here.

import type { Room, ClientMessage } from "@juntada/shared-types";
import type { ClientInfo } from "../state/roomStore";
import type { GameEngine } from "../games/engineTypes";
import { logger } from "../logger";

const { WebSocket } = require("ws");
type WS = import("ws").WebSocket;

const { rooms, clients, timers } = require("../state/roomStore") as {
  rooms: Map<string, Room>;
  clients: Map<WS, ClientInfo>;
  timers: Map<string, NodeJS.Timeout>;
};
const { getEngine } = require("../games/registry") as { getEngine: (gameType: string) => GameEngine | undefined };
const roomService = require("../rooms/roomService");
const { sendTo, sendError, broadcast, getRoomPublicState, sendPrivateInfo, broadcastState, broadcastRoundReveal } = require("./messaging");

function stopTimer(roomCode: string): void {
  const t = timers.get(roomCode);
  if (t) {
    clearTimeout(t);
    timers.delete(roomCode);
  }
}

// Re-derives whatever timer the room's current phase needs (if any) from the
// engine and (re)schedules it, replacing any previous one. Safe to call after
// every state-mutating action — cheap, and idempotent when nothing changed.
// When the scheduled timer fires, it's as if every online player pressed
// "ready": the engine decides where that leads, we just broadcast the result
// and immediately re-sync in case that opened up a next phase's timer.
function syncPhaseTimer(room: Room): void {
  stopTimer(room.code);
  const engine = getEngine(room.gameType);
  const endsAt = engine?.getPhaseTimerEnd?.(room);
  if (!endsAt) return;

  const expectedPhase = room.phase;
  const delay = endsAt - Date.now();
  if (delay <= 0) return;

  const t = setTimeout(() => {
    const r = rooms.get(room.code);
    if (!r || r.phase !== expectedPhase) return;
    const eng = getEngine(r.gameType);
    eng?.forceReadyAndAdvance?.(r);
    broadcastToRoom(r, ws2 => {
      sendTo(ws2, { type: "state", room: getRoomPublicState(r) });
    });
    if (r.phase === "result") broadcastRoundReveal(r);
    syncPhaseTimer(r);
  }, delay);
  timers.set(room.code, t);
}

function broadcastToRoom(room: Room, message: (ws2: WS, info: ClientInfo) => void): void {
  for (const [ws2, i2] of clients) {
    if (i2.roomCode === room.code && ws2.readyState === WebSocket.OPEN) message(ws2, i2);
  }
}

function createRoom(ws: WS, msg: Extract<ClientMessage, { type: "create_room" }>): void {
  const { room, error } = roomService.createRoom(ws, {
    playerName: msg.playerName,
    roomName: msg.roomName,
    gameType: msg.gameType,
  });
  if (error) {
    sendError(ws, "CREATE_ROOM_FAILED", error);
    return;
  }
  sendTo(ws, { type: "joined", playerId: room.hostId, roomCode: room.code, room: getRoomPublicState(room) });
}

function joinRoom(ws: WS, msg: Extract<ClientMessage, { type: "join_room" }>): void {
  const { room, playerId, error } = roomService.joinRoom(ws, { code: msg.code, playerName: msg.playerName });
  if (error) {
    sendError(ws, "JOIN_ROOM_FAILED", error);
    return;
  }
  // Joining is only ever allowed during "lobby" (roomService rejects it
  // otherwise), so there's never a round in progress to send private info for.
  sendTo(ws, { type: "joined", playerId, roomCode: room.code, room: getRoomPublicState(room) });
  broadcast(room.code, { type: "state", room: getRoomPublicState(room) }, ws);
}

function rejoin(ws: WS, msg: Extract<ClientMessage, { type: "rejoin" }>): void {
  const { room, playerId, error } = roomService.rejoinRoom(ws, { roomCode: msg.roomCode, playerId: msg.playerId });
  if (error) {
    sendError(ws, "REJOIN_FAILED", error);
    return;
  }
  sendTo(ws, { type: "joined", playerId, roomCode: room.code, room: getRoomPublicState(room) });
  if (room.round) sendPrivateInfo(ws, room, playerId);
  broadcast(room.code, { type: "state", room: getRoomPublicState(room) }, ws);
}

function updateConfig(ws: WS, msg: Extract<ClientMessage, { type: "update_config" }>, info: ClientInfo): void {
  const room = rooms.get(info.roomCode ?? "");
  if (!room || room.hostId !== info.playerId) return;
  roomService.updateConfig(room, msg.config);
  broadcastState(room);
}

function startRoundHandler(ws: WS, msg: ClientMessage, info: ClientInfo): void {
  const room = rooms.get(info.roomCode ?? "");
  if (!room || room.hostId !== info.playerId) return;
  const engine = getEngine(room.gameType);
  if (!engine) return;
  const minPlayers = engine.minPlayers ?? 2;
  if (room.players.length < minPlayers) {
    sendError(ws, "NOT_ENOUGH_PLAYERS", `Necesitás al menos ${minPlayers} jugadores`);
    return;
  }
  const res = engine.startRound(room);
  if (res.error) {
    sendError(ws, "START_ROUND_FAILED", res.error);
    return;
  }
  broadcastToRoom(room, (ws2, i2) => {
    sendTo(ws2, { type: "state", room: getRoomPublicState(room) });
    if (i2.playerId) sendPrivateInfo(ws2, room, i2.playerId);
  });
  syncPhaseTimer(room);
}

// Generic entry point for any in-round player action (clue, ready, vote,
// skip_word, ...). The specific action names/payloads are entirely defined
// by the game engine — this stays game-agnostic. A "rerolled" result means
// the engine changed the round's private info (e.g. a new secret word), so
// every player needs a fresh private_role message, not just the public state.
function gameAction(actionType: string) {
  return (ws: WS, msg: ClientMessage, info: ClientInfo): void => {
    const room = rooms.get(info.roomCode ?? "");
    if (!room || !info.playerId) return;
    const engine = getEngine(room.gameType);
    const result = engine?.handleAction(room, info.playerId, actionType, msg as Record<string, unknown>);
    if (!result?.handled) {
      sendError(ws, "INVALID_ACTION", "Esa acción no es válida ahora");
      return;
    }

    if (result.rerolled) {
      broadcastToRoom(room, (ws2, i2) => {
        sendTo(ws2, { type: "state", room: getRoomPublicState(room) });
        if (i2.playerId) sendPrivateInfo(ws2, room, i2.playerId);
      });
    } else {
      broadcastState(room);
    }
    if (room.phase === "result") broadcastRoundReveal(room);
    syncPhaseTimer(room);
  };
}

function backToLobby(ws: WS, msg: ClientMessage, info: ClientInfo): void {
  const room = rooms.get(info.roomCode ?? "");
  if (!room || room.hostId !== info.playerId) return;
  stopTimer(room.code);
  room.phase = "lobby";
  room.round = null;
  room.players.forEach(p => {
    p.ready = false;
  });
  broadcastState(room);
}

function kickPlayer(ws: WS, msg: Extract<ClientMessage, { type: "kick_player" }>, info: ClientInfo): void {
  const room = rooms.get(info.roomCode ?? "");
  if (!room || room.hostId !== info.playerId) return;
  roomService.kickPlayer(room, msg.targetId);
  logger.info({ roomCode: room.code, targetId: msg.targetId, byHostId: info.playerId }, "player kicked");

  // The kick can be exactly what a phase was waiting on (e.g. it was the
  // last player who hadn't voted/readied) — re-check right away, the same
  // way markOffline does for disconnects, so the round doesn't stall until
  // some other action happens to trigger it.
  const engine = getEngine(room.gameType);
  engine?.maybeAdvance(room);

  broadcastToRoom(room, (ws2, i2) => {
    if (i2.playerId === msg.targetId) {
      sendTo(ws2, { type: "kicked" });
      clients.set(ws2, { roomCode: null, playerId: null });
    } else {
      sendTo(ws2, { type: "state", room: getRoomPublicState(room) });
    }
  });
  if (room.phase === "result") broadcastRoundReveal(room);
  syncPhaseTimer(room);
}

function ping(ws: WS): void {
  sendTo(ws, { type: "pong" });
}

function handleDisconnect(ws: WS): void {
  const info = clients.get(ws);
  if (info?.roomCode) {
    const room = rooms.get(info.roomCode);
    if (room && info.playerId) {
      logger.debug({ roomCode: room.code, playerId: info.playerId }, "player disconnected");
      roomService.markOffline(room, info.playerId);
      broadcastState(room);
      if (room.phase === "result") broadcastRoundReveal(room);
      if (room.round) syncPhaseTimer(room);
      if (roomService.isRoomFullyOffline(room)) roomService.scheduleRoomCleanup(room.code);
    }
  }
  clients.delete(ws);
}

type Handler = (ws: WS, msg: any, info: ClientInfo) => void;

// Message type -> handler(ws, msg, info)
const HANDLERS: Record<string, Handler> = {
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
  confirm_letter: gameAction("confirm_letter"),
  submit_answers: gameAction("submit_answers"),
  call_basta: gameAction("call_basta"),
  mark_word: gameAction("mark_word"),
  confirm_review: gameAction("confirm_review"),
  reveal: gameAction("reveal"),
  assign: gameAction("assign"),
  vote_end: gameAction("vote_end"),
  back_to_lobby: backToLobby,
  kick_player: kickPlayer,
  ping: ws => ping(ws),
};

module.exports = { HANDLERS, handleDisconnect };
