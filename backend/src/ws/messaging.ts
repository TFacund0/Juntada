// ─── WS Messaging Helpers ──────────────────────────────────────────────────────
// Low-level send/broadcast primitives plus the public/private view builders.
// The room-level fields here are generic; anything about "what's happening
// in this round" is delegated to the room's game engine.

import type { Room, RoomPublicState, ServerMessage, ErrorCode } from "@juntada/shared-types";
import type { ClientInfo } from "../state/roomStore";
import type { GameEngine } from "../games/engineTypes";

const { WebSocket } = require("ws");
type WS = import("ws").WebSocket;

const { rooms, clients } = require("../state/roomStore") as {
  rooms: Map<string, Room>;
  clients: Map<WS, ClientInfo>;
};
const { getEngine } = require("../games/registry") as { getEngine: (gameType: string) => GameEngine | undefined };

function sendTo(ws: WS, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

// Single place every WS error gets constructed, so the shape (code + message)
// can never drift between handlers — see ErrorCode in @juntada/shared-types
// for what each code means and when a handler should reach for it.
function sendError(ws: WS, code: ErrorCode, message: string): void {
  sendTo(ws, { type: "error", code, message });
}

function broadcast(roomCode: string, message: ServerMessage, excludeWs: WS | null = null): void {
  const room = rooms.get(roomCode);
  if (!room) return;
  const data = JSON.stringify(message);
  for (const [ws, info] of clients) {
    if (info.roomCode === roomCode && ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

function getRoomPublicState(room: Room): RoomPublicState {
  const engine = getEngine(room.gameType);
  return {
    code: room.code,
    name: room.name,
    hostId: room.hostId,
    gameType: room.gameType,
    phase: room.phase,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      online: p.online,
      hasVoted: !!(room.round as any)?.votes?.[p.id],
    })),
    config: room.config,
    round: engine?.getPublicRoundView(room) ?? null,
    usedWords: room.usedWords,
    roundHistory: room.roundHistory,
  };
}

function sendPrivateInfo(ws: WS, room: Room, playerId: string): void {
  const engine = getEngine(room.gameType);
  const view = engine?.getPrivateView(room, playerId);
  if (!view) return;
  sendTo(ws, { type: "private_role", ...view });
}

function broadcastState(room: Room): void {
  broadcast(room.code, { type: "state", room: getRoomPublicState(room) });
}

function broadcastRoundReveal(room: Room): void {
  const engine = getEngine(room.gameType);
  const message = engine?.getRevealMessage?.(room);
  if (message) broadcast(room.code, message);
}

module.exports = {
  sendTo,
  sendError,
  broadcast,
  getRoomPublicState,
  sendPrivateInfo,
  broadcastState,
  broadcastRoundReveal,
};
