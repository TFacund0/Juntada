// ─── WS Messaging Helpers ──────────────────────────────────────────────────────
// Low-level send/broadcast primitives plus the public/private view builders.
// The room-level fields here are generic; anything about "what's happening
// in this round" is delegated to the room's game engine.

import type { Room, RoomPublicState, Group, GroupPublicState, ServerMessage, ErrorCode, ChatMessage } from "@juntada/shared-types";
import type { ClientInfo } from "../state/roomStore";
import type { GameEngine } from "../games/engineTypes";

const { WebSocket } = require("ws");
type WS = import("ws").WebSocket;

const { rooms, groups, clients } = require("../state/roomStore") as {
  rooms: Map<string, Room>;
  groups: Map<string, Group>;
  clients: Map<WS, ClientInfo>;
};
const { getEngine } = require("../games/registry") as {
  getEngine: (gameType: string | null | undefined) => GameEngine | undefined;
};
const { MAX_PLAYERS_PER_ROOM } = require("../rooms/roomService") as { MAX_PLAYERS_PER_ROOM: number };
const { MAX_MEMBERS_PER_GROUP } = require("../rooms/groupService") as { MAX_MEMBERS_PER_GROUP: number };

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

// Every client whose groupCode matches gets this — regardless of which
// instance (if any) they're currently attached to, since the group screen
// (member list, open instances) is relevant to the whole group at once.
function broadcastGroup(groupCode: string, message: ServerMessage, excludeWs: WS | null = null): void {
  const group = groups.get(groupCode);
  if (!group) return;
  const data = JSON.stringify(message);
  for (const [ws, info] of clients) {
    if (info.groupCode === groupCode && ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
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
    groupCode: room.groupCode,
    phase: room.phase,
    players: room.players.map(p => ({
      id: p.id,
      accountId: p.accountId,
      name: p.name,
      ready: p.ready,
      online: p.online,
      offlineSince: p.offlineSince,
      // room.round is `unknown` (each engine owns its own shape) — narrowed
      // just enough to read the one field some engines (e.g. impostor) keep
      // a live vote tally in, instead of an unbounded `as any`.
      hasVoted: !!(room.round as { votes?: Record<string, unknown> } | null)?.votes?.[p.id],
    })),
    maxPlayers: engine?.maxPlayers ?? MAX_PLAYERS_PER_ROOM,
    config: room.config,
    round: engine?.getPublicRoundView(room) ?? null,
    usedWords: room.usedWords,
    roundHistory: room.roundHistory,
    chat: room.chat,
  };
}

// Side-channel chat (room or group) is unbounded input over a long-lived
// session — cap how much history is kept so a chatty group night doesn't
// grow either array (and the state payload broadcast on every message)
// forever. Well past what anyone scrolls back to in a floating chat bubble.
const MAX_CHAT_HISTORY = 200;

function appendChatMessage(log: ChatMessage[], playerId: string, playerName: string, text: string): void {
  log.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, playerId, playerName, text, ts: Date.now() });
  if (log.length > MAX_CHAT_HISTORY) log.splice(0, log.length - MAX_CHAT_HISTORY);
}

// The group's open instances, summarized just enough for a join button —
// scans every room for the ones linked back to this group.
function getGroupPublicState(group: Group): GroupPublicState {
  const instances = [...rooms.values()]
    .filter(r => r.groupCode === group.code)
    .map(r => {
      const engine = getEngine(r.gameType);
      const host = r.players.find(p => p.id === r.hostId);
      return {
        roomCode: r.code,
        gameType: r.gameType,
        phase: r.phase,
        playerCount: r.players.length,
        maxPlayers: engine?.maxPlayers ?? MAX_PLAYERS_PER_ROOM,
        hostName: host?.name ?? "",
      };
    });
  return {
    code: group.code,
    name: group.name,
    hostId: group.hostId,
    members: group.members,
    maxMembers: MAX_MEMBERS_PER_GROUP,
    instances,
    chat: group.chat,
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

function broadcastGroupState(group: Group): void {
  broadcastGroup(group.code, { type: "group_state", group: getGroupPublicState(group) });
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
  broadcastGroup,
  getRoomPublicState,
  getGroupPublicState,
  sendPrivateInfo,
  broadcastState,
  broadcastGroupState,
  broadcastRoundReveal,
  appendChatMessage,
};
