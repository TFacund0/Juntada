// ─── Room Service ────────────────────────────────────────────────────────────
// Generic room/player lifecycle shared by every game: creating and joining
// rooms, host-only actions (kick, config), reconnecting, and disconnect
// bookkeeping. Delegates anything game-specific to the engine in
// src/games/registry.js. This file should never need to change to add a
// new game to Juntada.

const { v4: uuidv4 } = require("uuid");
const { rooms, clients } = require("../state/roomStore");
const { generateUniqueRoomCode } = require("./roomCode");
const { getEngine } = require("../games/registry");

const ONLINE_CLEANUP_DELAY_MS = 5 * 60 * 1000;
const MAX_PLAYERS_PER_ROOM = 16;
const MAX_TOTAL_ROOMS = 500;

function createRoom(ws, { playerName, roomName, gameType = "impostor" }) {
  const engine = getEngine(gameType);
  if (!engine) return { error: `Juego desconocido: ${gameType}` };
  if (rooms.size >= MAX_TOTAL_ROOMS) return { error: "El servidor está lleno, probá de nuevo en un rato" };

  const code = generateUniqueRoomCode();
  const playerId = uuidv4();
  const room = {
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
  return { room, playerId };
}

function isNameTaken(room, name) {
  return room.players.some(p => p.name.toLowerCase() === name.toLowerCase());
}

function joinRoom(ws, { code, playerName }) {
  const room = rooms.get(code?.toUpperCase());
  if (!room) return { error: "Sala no encontrada" };
  if (room.phase !== "lobby" && room.phase !== "round") return { error: "La partida ya comenzó" };
  if (room.players.length >= MAX_PLAYERS_PER_ROOM) return { error: "La sala está llena" };

  const name = playerName || "Jugador";
  if (isNameTaken(room, name)) return { error: "Ese nombre ya está en uso en esta sala" };

  const playerId = uuidv4();
  room.players.push({ id: playerId, name, ready: false, online: true });
  clients.set(ws, { roomCode: room.code, playerId });
  return { room, playerId };
}

function rejoinRoom(ws, { roomCode, playerId }) {
  const room = rooms.get(roomCode);
  if (!room) return { error: "La sala ya no existe" };
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: "Ya no formás parte de esta sala" };
  player.online = true;
  clients.set(ws, { roomCode: room.code, playerId });
  return { room, playerId };
}

function updateConfig(room, patch) {
  Object.assign(room.config, patch);
}

function kickPlayer(room, targetId) {
  room.players = room.players.filter(p => p.id !== targetId);
}

function markOffline(room, playerId) {
  const p = room.players.find(p => p.id === playerId);
  if (p) p.online = false;
  const engine = getEngine(room.gameType);
  engine?.maybeAdvance(room);
}

function isRoomFullyOffline(room) {
  return room.players.every(p => !p.online);
}

function scheduleRoomCleanup(roomCode) {
  setTimeout(() => {
    const r = rooms.get(roomCode);
    if (r && isRoomFullyOffline(r)) rooms.delete(roomCode);
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
};
