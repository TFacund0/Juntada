// ─── WS Message Handlers ────────────────────────────────────────────────────
// One function per message type. Handlers only orchestrate: generic
// room/group concerns go through roomService/groupService, game-specific
// rules go through the engine registered for the room's gameType. No game
// rules live here.

import type { Room, Group, ClientMessage } from "@juntada/shared-types";
import type { ClientInfo } from "../state/roomStore";
import type { GameEngine } from "../games/engineTypes";
import { logger } from "../logger";

const { WebSocket } = require("ws");
type WS = import("ws").WebSocket;

const { rooms, groups, clients, timers } = require("../state/roomStore") as {
  rooms: Map<string, Room>;
  groups: Map<string, Group>;
  clients: Map<WS, ClientInfo>;
  timers: Map<string, NodeJS.Timeout>;
};
const { getEngine } = require("../games/registry") as {
  getEngine: (gameType: string | null | undefined) => GameEngine | undefined;
};
const roomService = require("../rooms/roomService");
const groupService = require("../rooms/groupService");
const {
  sendTo,
  sendError,
  broadcast,
  getRoomPublicState,
  getGroupPublicState,
  sendPrivateInfo,
  broadcastState,
  broadcastGroupState,
  broadcastRoundReveal,
} = require("./messaging");

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

// Deletes a game instance once nobody's left in it — otherwise it'd sit
// around forever in the group's "open instances" list with 0 players. A
// standalone room (no group) is left for scheduleRoomCleanup to reap instead,
// since going to 0 players there just means everyone disconnected, which is
// already handled by the normal offline-cleanup grace period.
function cleanupRoomIfEmpty(room: Room): void {
  if (room.players.length > 0) return;
  stopTimer(room.code);
  rooms.delete(room.code);
  if (room.groupCode) {
    const group = groups.get(room.groupCode);
    if (group) broadcastGroupState(group);
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

// ── Group handlers ───────────────────────────────────────────────────────────
// A group is the persistent lobby people share; game instances (rooms) open
// and close underneath it as members start/join/leave them independently —
// see rooms/groupService.ts and rooms/roomService.ts's *InstanceRoom helpers.

function createGroup(ws: WS, msg: Extract<ClientMessage, { type: "create_group" }>): void {
  const { group, playerId, error } = groupService.createGroup(ws, { playerName: msg.playerName, groupName: msg.groupName });
  if (error) {
    sendError(ws, "CREATE_GROUP_FAILED", error);
    return;
  }
  sendTo(ws, { type: "group_joined", playerId, groupCode: group.code, group: getGroupPublicState(group) });
}

function joinGroup(ws: WS, msg: Extract<ClientMessage, { type: "join_group" }>): void {
  const { group, playerId, error } = groupService.joinGroup(ws, { code: msg.code, playerName: msg.playerName });
  if (error) {
    sendError(ws, "JOIN_GROUP_FAILED", error);
    return;
  }
  sendTo(ws, { type: "group_joined", playerId, groupCode: group.code, group: getGroupPublicState(group) });
  broadcastGroupState(group);
}

// Restores group membership after a dropped socket, and — since a group
// member's current instance isn't tracked on the group itself — re-derives
// it by checking whether any room still has them in its player list.
function rejoinGroup(ws: WS, msg: Extract<ClientMessage, { type: "rejoin_group" }>): void {
  const { group, playerId, error } = groupService.rejoinGroup(ws, { groupCode: msg.groupCode, playerId: msg.playerId });
  if (error) {
    sendError(ws, "REJOIN_GROUP_FAILED", error);
    return;
  }
  sendTo(ws, { type: "group_joined", playerId, groupCode: group.code, group: getGroupPublicState(group) });

  const instance = [...rooms.values()].find(r => r.groupCode === group.code && r.players.some(p => p.id === playerId));
  if (instance) {
    const player = instance.players.find(p => p.id === playerId)!;
    player.online = true;
    clients.set(ws, { groupCode: group.code, roomCode: instance.code, playerId });
    sendTo(ws, { type: "joined", playerId, roomCode: instance.code, room: getRoomPublicState(instance) });
    if (instance.round) sendPrivateInfo(ws, instance, playerId);
    broadcast(instance.code, { type: "state", room: getRoomPublicState(instance) }, ws);
  }

  broadcastGroupState(group);
}

// Opens a new game instance under the group — any member can do this, not
// just the group's creator (see the whole point of this feature: nobody
// decides for everyone what the group plays next). The opener becomes that
// instance's own host and its first player; everyone else in the group sees
// it appear in the group screen and joins (or not) on their own.
function createInstance(ws: WS, msg: Extract<ClientMessage, { type: "create_instance" }>, info: ClientInfo): void {
  const group = groups.get(info.groupCode ?? "");
  if (!group || !info.playerId) return;
  const member = group.members.find(m => m.id === info.playerId);
  if (!member) return;

  const { room, error } = roomService.createInstanceRoom(group.code, msg.gameType, member.id, member.name, group.name);
  if (error) {
    sendError(ws, "CREATE_INSTANCE_FAILED", error);
    return;
  }
  clients.set(ws, { groupCode: group.code, roomCode: room.code, playerId: member.id });
  sendTo(ws, { type: "joined", playerId: member.id, roomCode: room.code, room: getRoomPublicState(room) });
  broadcastGroupState(group);
}

// A member joining an already-open instance. They can only ever be attached
// to one instance at a time — if they're already in a different one, that's
// left behind first (freeing them to move between games on their own terms).
function joinInstance(ws: WS, msg: Extract<ClientMessage, { type: "join_instance" }>, info: ClientInfo): void {
  const group = groups.get(info.groupCode ?? "");
  if (!group || !info.playerId) return;
  const member = group.members.find(m => m.id === info.playerId);
  if (!member) return;

  if (info.roomCode && info.roomCode !== msg.roomCode) leavePlayerFromInstance(info.roomCode, member.id, group);

  const { room, error } = roomService.joinInstanceRoom(msg.roomCode, member.id, member.name);
  if (error) {
    sendError(ws, "JOIN_INSTANCE_FAILED", error);
    return;
  }
  clients.set(ws, { groupCode: group.code, roomCode: room.code, playerId: member.id });
  sendTo(ws, { type: "joined", playerId: member.id, roomCode: room.code, room: getRoomPublicState(room) });
  broadcast(room.code, { type: "state", room: getRoomPublicState(room) }, ws);
  broadcastGroupState(group);
}

// Shared by both an explicit leave_instance and joinInstance's implicit
// "leave whatever you were in first" — removes the player, reassigns that
// instance's host if it was them, deletes the instance if it's now empty,
// and lets the instance's remaining players (if any) know.
function leavePlayerFromInstance(roomCode: string, playerId: string, group: Group): void {
  const room = rooms.get(roomCode);
  if (!room) return;
  roomService.removePlayer(room, playerId);
  const engine = getEngine(room.gameType);
  engine?.maybeAdvance(room);
  if (room.players.length === 0) {
    cleanupRoomIfEmpty(room);
  } else {
    broadcast(room.code, { type: "state", room: getRoomPublicState(room) });
    if (room.phase === "result") broadcastRoundReveal(room);
    syncPhaseTimer(room);
    // The instance's own list changed even if it's not empty — reflect the
    // new player count on the group screen.
    broadcastGroupState(group);
  }
}

function leaveInstance(ws: WS, msg: ClientMessage, info: ClientInfo): void {
  if (!info.groupCode || !info.roomCode || !info.playerId) return;
  const group = groups.get(info.groupCode);
  if (!group) return;
  leavePlayerFromInstance(info.roomCode, info.playerId, group);
  clients.set(ws, { groupCode: info.groupCode, roomCode: null, playerId: info.playerId });
  sendTo(ws, { type: "left_instance" });
}

// A member choosing to leave the group entirely — first drops whatever
// instance they're attached to (same as leaveInstance), then removes them
// from the group's roster, deleting the group outright if that empties it.
function leaveGroup(ws: WS, msg: ClientMessage, info: ClientInfo): void {
  if (!info.groupCode || !info.playerId) return;
  const group = groups.get(info.groupCode);
  if (!group) return;

  if (info.roomCode) leavePlayerFromInstance(info.roomCode, info.playerId, group);

  groupService.leaveGroup(group, info.playerId);
  clients.set(ws, { groupCode: null, roomCode: null, playerId: null });
  sendTo(ws, { type: "left_group" });

  if (group.members.length === 0) groups.delete(group.code);
  else broadcastGroupState(group);
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
      clients.set(ws2, { groupCode: room.groupCode, roomCode: null, playerId: i2.playerId });
    } else {
      sendTo(ws2, { type: "state", room: getRoomPublicState(room) });
    }
  });
  if (room.phase === "result") broadcastRoundReveal(room);
  syncPhaseTimer(room);
  if (room.groupCode) {
    const group = groups.get(room.groupCode);
    if (group) broadcastGroupState(group);
  }
}

function ping(ws: WS): void {
  sendTo(ws, { type: "pong" });
}

// How long a single disconnected player is allowed to sit offline (while
// others in the room/group stay connected) before being auto-removed, so
// one dropped connection doesn't keep holding up the game or cluttering the
// group's roster indefinitely. Whole-room/whole-group cleanup (see
// scheduleRoomCleanup/scheduleGroupCleanup) already handles the case where
// everyone is offline, so this only ever fires while someone else is still
// around to keep playing without the disconnected player in the way.
const PLAYER_OFFLINE_TIMEOUT_MS = 5 * 60 * 1000;

function schedulePlayerKick(roomCode: string, playerId: string): void {
  setTimeout(() => {
    const room = rooms.get(roomCode);
    if (!room) return;
    const player = room.players.find(p => p.id === playerId);
    if (!player || player.online) return;
    if (roomService.isRoomFullyOffline(room)) return;

    roomService.kickPlayer(room, playerId);
    logger.info({ roomCode, playerId }, "player auto-kicked after disconnect timeout");
    const engine = getEngine(room.gameType);
    engine?.maybeAdvance(room);
    broadcastToRoom(room, ws2 => sendTo(ws2, { type: "state", room: getRoomPublicState(room) }));
    if (room.phase === "result") broadcastRoundReveal(room);
    syncPhaseTimer(room);
    if (room.groupCode) {
      const group = groups.get(room.groupCode);
      if (group) broadcastGroupState(group);
    }
  }, PLAYER_OFFLINE_TIMEOUT_MS);
}

function scheduleGroupMemberKick(groupCode: string, playerId: string): void {
  setTimeout(() => {
    const group = groups.get(groupCode);
    if (!group) return;
    const member = group.members.find(m => m.id === playerId);
    if (!member || member.online) return;
    if (groupService.isGroupFullyOffline(group)) return;

    groupService.leaveGroup(group, playerId);
    logger.info({ groupCode, playerId }, "member auto-removed from group after disconnect timeout");
    if (group.members.length === 0) groups.delete(group.code);
    else broadcastGroupState(group);
  }, PLAYER_OFFLINE_TIMEOUT_MS);
}

function handleDisconnect(ws: WS): void {
  const info = clients.get(ws);
  if (info?.roomCode && info.playerId) {
    const room = rooms.get(info.roomCode);
    if (room) {
      logger.debug({ roomCode: room.code, playerId: info.playerId }, "player disconnected");
      roomService.markOffline(room, info.playerId);
      broadcastState(room);
      if (room.phase === "result") broadcastRoundReveal(room);
      if (room.round) syncPhaseTimer(room);
      if (roomService.isRoomFullyOffline(room) && !room.groupCode) roomService.scheduleRoomCleanup(room.code);
      else schedulePlayerKick(room.code, info.playerId);
    }
  }
  if (info?.groupCode && info.playerId) {
    const group = groups.get(info.groupCode);
    if (group) {
      groupService.markMemberOffline(group, info.playerId);
      broadcastGroupState(group);
      if (groupService.isGroupFullyOffline(group)) groupService.scheduleGroupCleanup(group.code);
      else scheduleGroupMemberKick(group.code, info.playerId);
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
  create_group: (ws, msg) => createGroup(ws, msg),
  join_group: (ws, msg) => joinGroup(ws, msg),
  rejoin_group: (ws, msg) => rejoinGroup(ws, msg),
  create_instance: createInstance,
  join_instance: joinInstance,
  leave_instance: leaveInstance,
  leave_group: leaveGroup,
  update_config: updateConfig,
  start_round: startRoundHandler,
  submit_clue: gameAction("submit_clue"),
  player_ready: gameAction("player_ready"),
  vote: gameAction("vote"),
  skip_word: gameAction("skip_word"),
  continue_round: gameAction("continue_round"),
  submit_guess: gameAction("submit_guess"),
  confirm_round_setup: gameAction("confirm_round_setup"),
  submit_spectrum: gameAction("submit_spectrum"),
  new_game: gameAction("new_game"),
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
