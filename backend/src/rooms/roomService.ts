// ─── Room Service ────────────────────────────────────────────────────────────
// Generic room/player lifecycle shared by every game: creating and joining
// rooms, host-only actions (kick, config), reconnecting, and disconnect
// bookkeeping. Delegates anything game-specific to the engine in
// src/games/registry.js. This file should never need to change to add a
// new game to Juntada.

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
const { getEngine } = require("../games/registry") as { getEngine: (gameType: string) => GameEngine | undefined };

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
  { playerName, roomName, gameType = "impostor" }: { playerName?: string; roomName?: string; gameType?: string },
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
    phase: "lobby", // lobby | round | voting | result (meaning of round/voting/result is game-defined)
    players: [{ id: playerId, name: playerName || "Anfitrión", ready: false, online: true }],
    config: engine.createConfig(),
    round: null,
    usedWords: {},
    roundHistory: [],
  };
  rooms.set(code, room);
  clients.set(ws, { roomCode: code, playerId });
  logger.info({ roomCode: code, gameType, playerCount: rooms.size }, "room created");
  return { room, playerId };
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
  clients.set(ws, { roomCode: room.code, playerId });
  return { room, playerId };
}

function rejoinRoom(ws: WebSocket, { roomCode, playerId }: { roomCode: string; playerId: string }): RoomResult {
  const room = rooms.get(roomCode);
  if (!room) return { error: "La sala ya no existe" };
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: "Ya no formás parte de esta sala" };
  player.online = true;
  clients.set(ws, { roomCode: room.code, playerId });
  return { room, playerId };
}

function updateConfig(room: Room, patch: Record<string, unknown>): void {
  Object.assign(room.config, patch);
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
  setTimeout(() => {
    const r = rooms.get(roomCode);
    if (r && isRoomFullyOffline(r)) {
      rooms.delete(roomCode);
      logger.info({ roomCode, remainingRooms: rooms.size }, "room closed: fully offline past grace period");
    }
  }, ONLINE_CLEANUP_DELAY_MS);
}

module.exports = {
  createRoom,
  joinRoom,
  rejoinRoom,
  updateConfig,
  kickPlayer,
  markOffline,
  isRoomFullyOffline,
  scheduleRoomCleanup,
  MAX_PLAYERS_PER_ROOM,
};
