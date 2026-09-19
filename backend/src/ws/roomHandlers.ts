// ─── Room Message Handlers ───────────────────────────────────────────────────
// Handlers for a standalone room/game instance: creation, joining, host-only
// controls, and in-round actions. Generic room/game concerns go through
// roomService/the room's engine — no game rules live here. Group-anchored
// concerns (create_group, join_instance, ...) live in groupHandlers.ts.

import type { Room, ClientMessage } from "@juntada/shared-types";
import type { ClientInfo } from "../state/roomStore";
import type { GameEngine } from "../games/engineTypes";
import { logger } from "../logger";

type WS = import("ws").WebSocket;

const { rooms, groups, clients } = require("../state/roomStore") as {
  rooms: Map<string, Room>;
  groups: Map<string, import("@juntada/shared-types").Group>;
  clients: Map<WS, ClientInfo>;
};
const { getEngine } = require("../games/registry") as {
  getEngine: (gameType: string | null | undefined) => GameEngine | undefined;
};
const roomService = require("../rooms/roomService");
const { authService } = require("../auth") as { authService: { getSelf: (userId: string) => Promise<{ username: string }> } };
const {
  sendTo,
  sendError,
  broadcast,
  getRoomPublicState,
  sendPrivateInfo,
  broadcastState,
  broadcastGroupState,
  broadcastRoundReveal,
  appendChatMessage,
} = require("./messaging");
const {
  stopTimer,
  syncPhaseTimer,
  broadcastToRoom,
  broadcastStateAndPrivateInfo,
  releaseStaleIdentity,
  cleanupRoomIfEmpty,
  PLAYER_OFFLINE_TIMEOUT_MS,
} = require("./shared");

// The room's display name is always the account's current username — never
// client-supplied (see design.md's room-membership delta). Resolved once per
// create/join via the already-authenticated accountId from the handshake.
async function createRoom(ws: WS, msg: Extract<ClientMessage, { type: "create_room" }>, info: ClientInfo): Promise<void> {
  if (!info.accountId) return;
  const prevInfo = clients.get(ws);
  const self = await authService.getSelf(info.accountId);
  const { room, error } = roomService.createRoom(ws, {
    accountId: info.accountId,
    username: self.username,
    roomName: msg.roomName,
    gameType: msg.gameType,
  });
  if (error) {
    sendError(ws, "CREATE_ROOM_FAILED", error);
    return;
  }
  releaseStaleIdentity(prevInfo);
  sendTo(ws, { type: "joined", playerId: room.hostId, roomCode: room.code, room: getRoomPublicState(room) });
}

function checkRoomCode(ws: WS, msg: Extract<ClientMessage, { type: "check_room_code" }>): void {
  const code = msg.code.toUpperCase();
  const room = rooms.get(code);
  if (room) {
    sendTo(ws, { type: "room_preview", code: msg.code, found: true, name: room.name, gameType: room.gameType });
    return;
  }
  // A code that belongs to a group rather than a room is a common mix-up
  // (both are 5-char codes shared the same way) — flag it explicitly so the
  // join form can offer to switch to the group flow instead of just saying
  // "not found".
  const group = groups.get(code);
  if (group) {
    sendTo(ws, { type: "room_preview", code: msg.code, found: false, isGroupCode: true, name: group.name });
    return;
  }
  sendTo(ws, { type: "room_preview", code: msg.code, found: false });
}

async function joinRoom(ws: WS, msg: Extract<ClientMessage, { type: "join_room" }>, info: ClientInfo): Promise<void> {
  if (!info.accountId) return;
  const prevInfo = clients.get(ws);
  const self = await authService.getSelf(info.accountId);
  const { room, playerId, error } = roomService.joinRoom(ws, { code: msg.code, accountId: info.accountId, username: self.username });
  if (error) {
    sendError(ws, "JOIN_ROOM_FAILED", error);
    return;
  }
  releaseStaleIdentity(prevInfo);
  // A join mid-round lands the player in room.waitingPlayers (see
  // roomService.joinRoom) instead of getting rejected — there's still never
  // private round info to send them, since they're invisible to the engine
  // until the room flushes them back to "lobby".
  sendTo(ws, { type: "joined", playerId, roomCode: room.code, room: getRoomPublicState(room) });
  broadcast(room.code, { type: "state", room: getRoomPublicState(room) }, ws);
}

// The seat is resolved purely from the authenticated accountId (handshake
// JWT) — no client-supplied playerId anymore (see design.md's
// account-reconnection delta).
function rejoin(ws: WS, msg: Extract<ClientMessage, { type: "rejoin" }>, info: ClientInfo): void {
  if (!info.accountId) return;
  const { room, playerId, error } = roomService.rejoinRoom(ws, { roomCode: msg.roomCode, accountId: info.accountId });
  if (error) {
    sendError(ws, "REJOIN_FAILED", error);
    return;
  }
  // Coming back online can be exactly what a phase was waiting on — e.g. this
  // player was the last (or only) guesser still marked online when they
  // dropped mid-round, which made markOffline's online-count check bail out
  // without finishing the round even though their answer was already in. Left
  // unchecked here, the round would stay stuck forever since nothing else
  // re-triggers maybeAdvance until another player acts. Same re-check kick
  // and disconnect already do.
  const engine = getEngine(room.gameType);
  engine?.maybeAdvance(room);

  sendTo(ws, { type: "joined", playerId, roomCode: room.code, room: getRoomPublicState(room) });
  if (room.round) sendPrivateInfo(ws, room, playerId);
  broadcast(room.code, { type: "state", room: getRoomPublicState(room) }, ws);
  if (room.phase === "result") broadcastRoundReveal(room);
  syncPhaseTimer(room);
}

function updateConfig(ws: WS, msg: Extract<ClientMessage, { type: "update_config" }>, info: ClientInfo): void {
  const room = rooms.get(info.roomCode ?? "");
  if (!room || room.hostId !== info.playerId) return;
  // The ConfigPanel only ever renders in the lobby — nothing legitimate
  // sends this outside it. Blocking it elsewhere stops a stale/replayed
  // message (or a modified client) from editing config the round already
  // committed to (e.g. Ruleta's entries/mode) out from under an in-progress
  // round, desyncing what each client shows.
  if (room.phase !== "lobby") return;
  roomService.updateConfig(room, msg.config);
  broadcastState(room);
}

function startRoundHandler(ws: WS, msg: ClientMessage, info: ClientInfo): void {
  const room = rooms.get(info.roomCode ?? "");
  if (!room || room.hostId !== info.playerId) return;
  // "lobby" is the very first start; "result" is every game's own
  // "jugar de nuevo"/"nueva ronda" button. Anything else means a
  // stale/duplicate/replayed message arrived mid-round — letting it through
  // would make the engine rebuild round state on top of an in-progress one
  // (wiping a bracket's reported results, a Ruleta spin, a board mid-move).
  if (room.phase !== "lobby" && room.phase !== "result") return;
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
  broadcastStateAndPrivateInfo(room);
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
      broadcastStateAndPrivateInfo(room);
    } else {
      broadcastState(room);
    }
    if (room.phase === "result") broadcastRoundReveal(room);
    syncPhaseTimer(room);
  };
}

// Free-text chat scoped to whatever instance the sender is currently
// attached to — independent of any game mechanic, unlike gameAction's
// send_chat_message (only some engines accept that, and only mid-round).
// Cleared with the instance: rejoining a fresh game starts a clean log.
function sendRoomChat(ws: WS, msg: Extract<ClientMessage, { type: "send_room_chat" }>, info: ClientInfo): void {
  const room = rooms.get(info.roomCode ?? "");
  if (!room || !info.playerId) return;
  const player = room.players.find((p: Room["players"][number]) => p.id === info.playerId);
  if (!player) return;
  appendChatMessage(room.chat, player.id, player.name, msg.text);
  broadcastState(room);
}

// Any player can send the room back to the lobby (not just the host) — same
// as leaving an instance, this only interrupts the current match for
// everyone, it doesn't touch anyone's membership or host status, so there's
// no real harm in letting whoever's playing bail out for the group.
function backToLobby(ws: WS, msg: ClientMessage, info: ClientInfo): void {
  const room = rooms.get(info.roomCode ?? "");
  if (!room || !room.players.some(p => p.id === info.playerId)) return;
  stopTimer(room.code);
  room.phase = "lobby";
  room.round = null;
  // "Volver al lobby" interrupts the match entirely, not just the current
  // round — the next "Iniciar ronda" from the lobby is a brand-new match, so
  // whatever score/round history had piled up shouldn't carry over into it.
  getEngine(room.gameType)?.resetProgress?.(room);
  room.players.forEach((p: Room["players"][number]) => {
    p.ready = false;
  });
  broadcastState(room);
}

// A player choosing to leave a standalone room on their own, mid-match — the
// no-group counterpart of groupHandlers.leaveInstance. Removes them right
// away (reassigning host if needed) instead of leaving the rest of the room
// waiting on the 1-minute offline-kick grace period a plain disconnect would
// trigger.
function leaveRoom(ws: WS, msg: ClientMessage, info: ClientInfo): void {
  const room = rooms.get(info.roomCode ?? "");
  if (!room || !info.playerId) return;
  roomService.removePlayer(room, info.playerId);
  const engine = getEngine(room.gameType);
  engine?.maybeAdvance(room);
  clients.set(ws, { groupCode: null, roomCode: null, playerId: null, accountId: info.accountId });
  sendTo(ws, { type: "left_room" });
  if (room.players.length === 0) {
    cleanupRoomIfEmpty(room);
    return;
  }
  broadcastStateAndPrivateInfo(room);
  if (room.phase === "result") broadcastRoundReveal(room);
  syncPhaseTimer(room);
}

function kickPlayer(ws: WS, msg: Extract<ClientMessage, { type: "kick_player" }>, info: ClientInfo): void {
  const room = rooms.get(info.roomCode ?? "");
  if (!room || room.hostId !== info.playerId || msg.targetId === info.playerId) return;
  roomService.kickPlayer(room, msg.targetId);
  logger.info({ roomCode: room.code, targetId: msg.targetId, byHostId: info.playerId }, "player kicked");

  broadcastToRoom(room, (ws2: WS, i2: ClientInfo) => {
    if (i2.playerId === msg.targetId) {
      sendTo(ws2, { type: "kicked" });
      clients.set(ws2, { groupCode: room.groupCode, roomCode: null, playerId: i2.playerId, accountId: i2.accountId });
    }
  });

  // A kick can empty the room outright (last remaining non-host player
  // kicked, or — since nothing else here stops it — a host who somehow
  // targets their own playerId elsewhere). Unlike a disconnect, no socket
  // ever goes through handleDisconnect for this, so scheduleRoomCleanup's
  // grace-period timer never gets scheduled either — without this, an empty
  // room from this path sat in `rooms` forever, counting against
  // MAX_TOTAL_ROOMS with nobody left who could ever trigger its cleanup.
  if (room.players.length === 0) {
    cleanupRoomIfEmpty(room);
    return;
  }

  // The kick can be exactly what a phase was waiting on (e.g. it was the
  // last player who hadn't voted/readied) — re-check right away, the same
  // way markOffline does for disconnects, so the round doesn't stall until
  // some other action happens to trigger it.
  const engine = getEngine(room.gameType);
  engine?.maybeAdvance(room);

  // The kick (via maybeAdvance above) can itself trigger a phase change
  // that affects what each remaining player should privately see (e.g.
  // quien-soy's suggest/vote phases reassigning words or moving on to
  // the next vote target) — resend private info so nobody's stuck
  // showing stale options until their next action or a manual refresh.
  broadcastStateAndPrivateInfo(room);
  if (room.phase === "result") broadcastRoundReveal(room);
  syncPhaseTimer(room);
  if (room.groupCode) {
    const group = groups.get(room.groupCode);
    if (group) broadcastGroupState(group);
  }
}

// A game can override how long its own disconnected players get before
// getting auto-kicked (see GameEngine's offlineKickTimeoutMs — e.g. Impostor
// shortens this during voting, where a stuck vote blocks everyone else).
// Falls back to the generic 1-minute grace period otherwise.
function schedulePlayerKick(roomCode: string, playerId: string): void {
  const room = rooms.get(roomCode);
  const timeoutMs = getEngine(room?.gameType)?.offlineKickTimeoutMs?.(room!, playerId) ?? PLAYER_OFFLINE_TIMEOUT_MS;
  setTimeout(() => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const player = roomService.findPlayer(room, playerId);
    if (!player || player.online) return;
    if (roomService.isRoomFullyOffline(room)) return;

    roomService.kickPlayer(room, playerId);
    logger.info({ roomCode, playerId }, "player auto-kicked after disconnect timeout");
    const engine = getEngine(room.gameType);
    engine?.maybeAdvance(room);
    broadcastStateAndPrivateInfo(room);
    if (room.phase === "result") broadcastRoundReveal(room);
    syncPhaseTimer(room);
    if (room.groupCode) {
      const group = groups.get(room.groupCode);
      if (group) broadcastGroupState(group);
    }
  }, timeoutMs).unref();
}

module.exports = {
  createRoom,
  checkRoomCode,
  joinRoom,
  rejoin,
  updateConfig,
  startRoundHandler,
  gameAction,
  sendRoomChat,
  backToLobby,
  leaveRoom,
  kickPlayer,
  schedulePlayerKick,
  PLAYER_OFFLINE_TIMEOUT_MS,
};
