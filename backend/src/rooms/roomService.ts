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
const { rooms, clients } = require("../state/roomStore") as {
  rooms: Map<string, Room>;
  clients: Map<WebSocket, ClientInfo>;
};
const { generateUniqueRoomCode } = require("./roomCode") as { generateUniqueRoomCode: () => string };
const { getEngine } = require("../games/registry") as {
  getEngine: (gameType: string | null | undefined) => GameEngine | undefined;
};

const ONLINE_CLEANUP_DELAY_MS = 5 * 60 * 1000;
const MAX_PLAYERS_PER_ROOM = 16;
const MAX_TOTAL_ROOMS = 500;

interface RoomResult {
  room?: Room;
  playerId?: string;
  error?: string;
}

function createRoom(
  ws: WebSocket,
  { playerName, roomName, gameType }: { playerName?: string; roomName?: string; gameType: string },
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
    players: [{ id: playerId, name: playerName || "Anfitrión", ready: false, online: true }],
    config: engine.createConfig(),
    round: null,
    usedWords: {},
    roundHistory: [],
  };
  rooms.set(code, room);
  clients.set(ws, { groupCode: null, roomCode: code, playerId });
  logger.info({ roomCode: code, gameType, playerCount: rooms.size }, "room created");
  return { room, playerId };
}

// Creates a new game instance under an existing group — same shape as
// createRoom, just linked back to the group and without registering a
// fresh websocket client entry (the caller's already attached to the group;
// see groupService.createInstance for the client bookkeeping).
function createInstanceRoom(groupCode: string, gameType: string, hostId: string, hostName: string, groupName: string): RoomResult {
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
    players: [{ id: hostId, name: hostName, ready: false, online: true }],
    config: engine.createConfig(),
    round: null,
    usedWords: {},
    roundHistory: [],
  };
  rooms.set(code, room);
  return { room };
}

function isNameTaken(room: Room, name: string): boolean {
  return room.players.some(p => p.name.toLowerCase() === name.toLowerCase());
}

function joinRoom(ws: WebSocket, { code, playerName }: { code?: string; playerName?: string }): RoomResult {
  const room = rooms.get(code?.toUpperCase() ?? "");
  if (!room) return { error: "No existe ninguna sala con ese código" };
  if (room.phase !== "lobby") return { error: "La partida ya empezó, esperá a que termine la ronda para unirte" };
  const engine = getEngine(room.gameType);
  const maxPlayers = engine?.maxPlayers ?? MAX_PLAYERS_PER_ROOM;
  if (room.players.length >= maxPlayers) return { error: "La sala está llena" };

  const name = playerName || "Jugador";
  if (isNameTaken(room, name)) return { error: "Ese nombre ya está en uso en esta sala" };

  const playerId: string = uuidv4();
  room.players.push({ id: playerId, name, ready: false, online: true });
  clients.set(ws, { groupCode: null, roomCode: room.code, playerId });
  return { room, playerId };
}

// A group member joining an instance already has an identity (playerId,
// name) from the group — reused as-is instead of minting a new one, so
// they're recognizable as the same person across every instance they join.
function joinInstanceRoom(roomCode: string, playerId: string, playerName: string): RoomResult {
  const room = rooms.get(roomCode);
  if (!room) return { error: "Esa partida ya no existe" };
  if (room.phase !== "lobby") return { error: "La partida ya empezó, esperá a que termine para unirte" };
  const engine = getEngine(room.gameType);
  const maxPlayers = engine?.maxPlayers ?? MAX_PLAYERS_PER_ROOM;
  if (room.players.length >= maxPlayers) return { error: "Esa partida está llena" };
  if (room.players.some(p => p.id === playerId)) return { room };
  if (isNameTaken(room, playerName)) return { error: "Ese nombre ya está en uso en esa partida" };

  room.players.push({ id: playerId, name: playerName, ready: false, online: true });
  return { room };
}

function rejoinRoom(ws: WebSocket, { roomCode, playerId }: { roomCode: string; playerId: string }): RoomResult {
  const room = rooms.get(roomCode);
  if (!room) return { error: "La sala ya no existe" };
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: "Ya no formás parte de esta sala" };
  player.online = true;
  clients.set(ws, { groupCode: room.groupCode, roomCode: room.code, playerId });
  return { room, playerId };
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
// and nobody able to configure/start rounds or kick. Prefers another online
// player; only reaches for an offline one if literally everybody else is
// offline too (about to be cleaned up anyway).
function reassignHostIfNeeded(room: Room, leavingId: string): void {
  if (room.hostId !== leavingId) return;
  const candidate = room.players.find(p => p.id !== leavingId && p.online) || room.players.find(p => p.id !== leavingId);
  if (candidate) {
    room.hostId = candidate.id;
    logger.info({ roomCode: room.code, newHostId: candidate.id }, "host handed off");
  }
}

function kickPlayer(room: Room, targetId: string): void {
  room.players = room.players.filter(p => p.id !== targetId);
  reassignHostIfNeeded(room, targetId);
}

// A player choosing to leave a game instance on their own (not kicked) —
// same removal as kickPlayer, but the caller (groupService.leaveInstance)
// also deletes the room outright once it's empty, unlike a standalone room
// which just sits there fully-offline until scheduleRoomCleanup reaps it.
function removePlayer(room: Room, playerId: string): void {
  room.players = room.players.filter(p => p.id !== playerId);
  reassignHostIfNeeded(room, playerId);
}

function markOffline(room: Room, playerId: string): void {
  const p = room.players.find(p => p.id === playerId);
  if (p) p.online = false;
  reassignHostIfNeeded(room, playerId);
  const engine = getEngine(room.gameType);
  engine?.maybeAdvance(room);
}

function isRoomFullyOffline(room: Room): boolean {
  return room.players.every(p => !p.online);
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
  isRoomFullyOffline,
  scheduleRoomCleanup,
  MAX_PLAYERS_PER_ROOM,
};
