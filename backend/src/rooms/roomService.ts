// ─── Room Service ────────────────────────────────────────────────────────────
// Generic room (game instance) lifecycle shared by every game: creating and
// joining, host-only actions (kick, config), reconnecting, and disconnect
// bookkeeping. Delegates anything game-specific to the engine in
// src/games/registry.js. This file should never need to change to add a
// new game to Juntada. Group lifecycle (the thing a room can optionally
// belong to) lives in groupService.ts.

import type { Room } from "@juntada/shared-types";
import type { WebSocket } from "ws";
import type { ClientInfo } from "../state/roomStore";
import type { GameEngine } from "../games/engineTypes";
import { logger } from "../logger";

const { v4: uuidv4 } = require("uuid");
const { rooms, clients, activeSockets, evictPreviousAccountSocket } = require("../state/roomStore") as {
  rooms: Map<string, Room>;
  clients: Map<WebSocket, ClientInfo>;
  activeSockets: Map<string, WebSocket>;
  evictPreviousAccountSocket: (scopeCode: string, accountId: string, newWs: WebSocket) => void;
};
const { generateUniqueRoomCode } = require("./roomCode") as { generateUniqueRoomCode: () => string };
const { getEngine } = require("../games/registry") as {
  getEngine: (gameType: string | null | undefined) => GameEngine | undefined;
};
const { ONLINE_CLEANUP_DELAY_MS } = require("./constants") as { ONLINE_CLEANUP_DELAY_MS: number };
const { pickHostReplacement } = require("./rosterUtils") as {
  pickHostReplacement: (roster: { id: string; name: string; online: boolean }[], leavingId: string) => { id: string } | undefined;
};

const MAX_PLAYERS_PER_ROOM = 16;
const MAX_TOTAL_ROOMS = 500;

interface RoomResult {
  room?: Room;
  playerId?: string;
  error?: string;
  waiting?: boolean;
}

function createRoom(
  ws: WebSocket,
  { accountId, username, roomName, gameType }: { accountId: string; username: string; roomName?: string; gameType: string },
): RoomResult {
  const engine = getEngine(gameType);
  if (!engine) return { error: `Juego desconocido: ${gameType}` };
  if (rooms.size >= MAX_TOTAL_ROOMS) return { error: "El servidor está lleno, probá de nuevo en un rato" };

  const code = generateUniqueRoomCode();
  const playerId: string = uuidv4();
  const room: Room = {
    code,
    name: roomName || "Sala sin nombre",
    hostId: playerId,
    gameType,
    groupCode: null,
    phase: "lobby",
    players: [{ id: playerId, accountId, name: username, ready: false, online: true }],
    waitingPlayers: [],
    config: engine.createConfig(),
    round: null,
    usedWords: {},
    roundHistory: [],
    chat: [],
  };
  rooms.set(code, room);
  clients.set(ws, { groupCode: null, roomCode: code, playerId, accountId });
  activeSockets.set(playerId, ws);
  evictPreviousAccountSocket(code, accountId, ws);
  logger.info({ roomCode: code, gameType, playerCount: rooms.size }, "room created");
  return { room, playerId };
}

// Creates a new game instance under an existing group — same shape as
// createRoom, just linked back to the group and without registering a
// fresh websocket client entry (the caller's already attached to the group;
// see groupService.createInstance for the client bookkeeping).
function createInstanceRoom(
  ws: WebSocket,
  groupCode: string,
  gameType: string,
  hostId: string,
  hostAccountId: string,
  hostUsername: string,
  groupName: string,
): RoomResult {
  const engine = getEngine(gameType);
  if (!engine) return { error: `Juego desconocido: ${gameType}` };
  if (rooms.size >= MAX_TOTAL_ROOMS) return { error: "El servidor está lleno, probá de nuevo en un rato" };

  const code = generateUniqueRoomCode();
  const room: Room = {
    code,
    name: groupName,
    hostId,
    gameType,
    groupCode,
    phase: "lobby",
    players: [{ id: hostId, accountId: hostAccountId, name: hostUsername, ready: false, online: true }],
    waitingPlayers: [],
    config: engine.createConfig(),
    round: null,
    usedWords: {},
    roundHistory: [],
    chat: [],
  };
  rooms.set(code, room);
  activeSockets.set(hostId, ws);
  evictPreviousAccountSocket(code, hostAccountId, ws);
  return { room };
}

function joinRoom(ws: WebSocket, { code, accountId, username }: { code?: string; accountId: string; username: string }): RoomResult {
  const room = rooms.get(code?.toUpperCase() ?? "");
  if (!room) return { error: "No existe ninguna sala con ese código" };
  const engine = getEngine(room.gameType);
  const maxPlayers = engine?.maxPlayers ?? MAX_PLAYERS_PER_ROOM;
  if (room.players.length + room.waitingPlayers.length >= maxPlayers) return { error: "La sala está llena" };

  const playerId: string = uuidv4();
  const player = { id: playerId, accountId, name: username, ready: false, online: true };
  // A round already in progress doesn't reject the join outright — the
  // player is held in waitingPlayers (invisible to the engine, see its type
  // comment) and joins the active roster automatically once the round ends
  // and the room returns to "lobby" (ws/shared.ts's flushWaitingPlayers).
  const waiting = room.phase !== "lobby";
  if (waiting) room.waitingPlayers.push(player);
  else room.players.push(player);
  clients.set(ws, { groupCode: null, roomCode: room.code, playerId, accountId });
  activeSockets.set(playerId, ws);
  evictPreviousAccountSocket(room.code, accountId, ws);
  return { room, playerId, waiting };
}

// A group member joining an instance already has an identity (playerId,
// accountId, username) from the group — reused as-is instead of minting a
// new one, so they're recognizable as the same person across every instance
// they join.
function joinInstanceRoom(ws: WebSocket, roomCode: string, playerId: string, accountId: string, username: string): RoomResult {
  const room = rooms.get(roomCode);
  if (!room) return { error: "Esa partida ya no existe" };
  const engine = getEngine(room.gameType);
  const maxPlayers = engine?.maxPlayers ?? MAX_PLAYERS_PER_ROOM;
  if (room.players.some(p => p.id === playerId)) {
    activeSockets.set(playerId, ws);
    evictPreviousAccountSocket(room.code, accountId, ws);
    return { room };
  }
  if (room.waitingPlayers.some(p => p.id === playerId)) {
    activeSockets.set(playerId, ws);
    evictPreviousAccountSocket(room.code, accountId, ws);
    return { room, waiting: true };
  }
  if (room.players.length + room.waitingPlayers.length >= maxPlayers) return { error: "Esa partida está llena" };

  const player = { id: playerId, accountId, name: username, ready: false, online: true };
  const waiting = room.phase !== "lobby";
  if (waiting) room.waitingPlayers.push(player);
  else room.players.push(player);
  activeSockets.set(playerId, ws);
  evictPreviousAccountSocket(room.code, accountId, ws);
  return { room, waiting };
}

// The seat is resolved purely from the authenticated `accountId` (see
// design.md's account-reconnection delta) — no client-supplied playerId
// enters this anymore. A device with no seat in this room (never joined, or
// already removed) is rejected with the same error message as before.
function rejoinRoom(ws: WebSocket, { roomCode, accountId }: { roomCode: string; accountId: string }): RoomResult {
  const room = rooms.get(roomCode);
  if (!room) return { error: "La sala ya no existe" };
  const player = room.players.find(p => p.accountId === accountId);
  const waitingPlayer = !player && room.waitingPlayers.find(p => p.accountId === accountId);
  const seat = player ?? waitingPlayer;
  if (!seat) return { error: "Ya no formás parte de esta sala" };
  seat.online = true;
  seat.offlineSince = undefined;
  clients.set(ws, { groupCode: room.groupCode, roomCode: room.code, playerId: seat.id, accountId });
  activeSockets.set(seat.id, ws);
  evictPreviousAccountSocket(room.code, accountId, ws);
  return { room, playerId: seat.id, waiting: !player };
}

// Each game defines its own config shape (see engine.createConfig()), so
// there's no single schema to validate a patch against here. Instead this
// only ever overwrites keys that already exist on the room's config, and
// only with a same-typed value — so a client can tweak known settings but
// can't inject new keys or swap a setting's type out from under the engine
// that reads it.
function updateConfig(room: Room, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.hasOwn(room.config, key)) continue;
    if (typeof value !== typeof (room.config as Record<string, unknown>)[key]) continue;
    (room.config as Record<string, unknown>)[key] = value;
  }
}

// If the player leaving/going offline was the host, hand the room off to
// someone still around rather than leaving it stuck with a host who's gone
// and nobody able to configure/start rounds or kick (see rosterUtils's
// pickHostReplacement for the actual candidate rule).
function reassignHostIfNeeded(room: Room, leavingId: string): void {
  if (room.hostId !== leavingId) return;
  const candidate = pickHostReplacement(room.players, leavingId);
  if (candidate) {
    room.hostId = candidate.id;
    logger.info({ roomCode: room.code, newHostId: candidate.id }, "host handed off");
  }
}

function kickPlayer(room: Room, targetId: string): void {
  room.players = room.players.filter(p => p.id !== targetId);
  room.waitingPlayers = room.waitingPlayers.filter(p => p.id !== targetId);
  reassignHostIfNeeded(room, targetId);
}

// A player choosing to leave a game instance on their own (not kicked) —
// same removal as kickPlayer, but the caller (groupService.leaveInstance)
// also deletes the room outright once it's empty, unlike a standalone room
// which just sits there fully-offline until scheduleRoomCleanup reaps it.
function removePlayer(room: Room, playerId: string): void {
  room.players = room.players.filter(p => p.id !== playerId);
  room.waitingPlayers = room.waitingPlayers.filter(p => p.id !== playerId);
  reassignHostIfNeeded(room, playerId);
}

// Looks a seat up regardless of whether it's an active player or still
// waiting for the current round to end — the connection lifecycle (offline
// marking, auto-kick) treats both the same way; only the game engine (which
// never sees waitingPlayers) draws that distinction.
function findPlayer(room: Room, playerId: string): Room["players"][number] | undefined {
  return room.players.find(p => p.id === playerId) ?? room.waitingPlayers.find(p => p.id === playerId);
}

// Moves every waiting joiner into the active roster once the room is back in
// "lobby" — called after every state-changing broadcast (see ws/shared.ts
// and ws/messaging.ts) so nobody has to remember to do it from whichever
// action happened to end the round.
function flushWaitingPlayers(room: Room): void {
  if (room.phase !== "lobby" || room.waitingPlayers.length === 0) return;
  room.players.push(...room.waitingPlayers);
  room.waitingPlayers = [];
}

// Deliberately does NOT call engine.maybeAdvance here: doing so used to let
// a single disconnect instantly count that player out of any "every online
// player must ready/vote/confirm" gate (writing/review, impostor's voting,
// ...) — a brief network blip or a backgrounded tab (which reconnects
// within seconds via the client's own retry loop) would silently skip them,
// and if they were the deciding vote the round could advance without them
// ever getting a say. The existing 1-minute auto-kick grace period
// (schedulePlayerKick, ws/roomHandlers.ts) already re-runs maybeAdvance once
// a still-offline player is actually removed — that's the only path that
// should let the rest of the room move on without them.
//
// Same reasoning applies to onPlayerOffline (a game's own low-stakes,
// turn-skipping reaction — e.g. handing off a strict turn rotation): it
// doesn't fire from here either. The caller (ws/handlers.ts's
// handleDisconnect) schedules it through ws/shared.ts's
// scheduleOfflineReaction instead, which waits a minute to see if the
// player reconnects on their own (answering a text, a few seconds of bad
// signal) before treating it as something worth reacting to.
function markOffline(room: Room, playerId: string): void {
  const p = findPlayer(room, playerId);
  if (p) {
    p.online = false;
    p.offlineSince = Date.now();
  }
  // Deliberately does NOT hand off the host here, even if they're the one
  // going offline — same reasoning as skipping maybeAdvance above: a brief
  // disconnect (network blip, backgrounded tab) shouldn't cost them
  // anything as permanent as losing host, only that reconnect grace period
  // reconnectDelayMs on the client is built around. reassignHostIfNeeded
  // still runs on the paths that mean they're actually, finally gone:
  // kickPlayer/removePlayer, including the 1-minute auto-kick timeout.
}

function isRoomFullyOffline(room: Room): boolean {
  return [...room.players, ...room.waitingPlayers].every(p => !p.online);
}

function scheduleRoomCleanup(roomCode: string): void {
  // unref'd so this background grace-period timer never keeps the process
  // itself alive (matters for clean shutdown / tests) — the server process
  // otherwise stays up regardless, so the timer still fires normally.
  setTimeout(() => {
    const r = rooms.get(roomCode);
    if (r && isRoomFullyOffline(r)) {
      rooms.delete(roomCode);
      logger.info({ roomCode, remainingRooms: rooms.size }, "room closed: fully offline past grace period");
    }
  }, ONLINE_CLEANUP_DELAY_MS).unref();
}

module.exports = {
  createRoom,
  createInstanceRoom,
  joinRoom,
  joinInstanceRoom,
  rejoinRoom,
  updateConfig,
  kickPlayer,
  removePlayer,
  markOffline,
  findPlayer,
  flushWaitingPlayers,
  isRoomFullyOffline,
  scheduleRoomCleanup,
  MAX_PLAYERS_PER_ROOM,
};
