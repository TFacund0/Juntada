// ─── Group Message Handlers ──────────────────────────────────────────────────
// A group is the persistent lobby people share; game instances (rooms) open
// and close underneath it as members start/join/leave them independently —
// see rooms/groupService.ts and rooms/roomService.ts's *InstanceRoom helpers.
// Generic room concerns an instance also needs (timers, broadcast) come from
// shared.ts; standalone-room-only handlers live in roomHandlers.ts.

import type { Room, Group, ClientMessage } from "@juntada/shared-types";
import type { ClientInfo } from "../state/roomStore";
import type { GameEngine } from "../games/engineTypes";
import { logger } from "../logger";

type WS = import("ws").WebSocket;

const { rooms, groups, clients } = require("../state/roomStore") as {
  rooms: Map<string, Room>;
  groups: Map<string, Group>;
  clients: Map<WS, ClientInfo>;
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
  broadcastGroupState,
  broadcastRoundReveal,
} = require("./messaging");
const { syncPhaseTimer, cleanupRoomIfEmpty, releaseStaleIdentity } = require("./shared");

function createGroup(ws: WS, msg: Extract<ClientMessage, { type: "create_group" }>): void {
  const prevInfo = clients.get(ws);
  const { group, playerId, error } = groupService.createGroup(ws, {
    playerName: msg.playerName,
    groupName: msg.groupName,
  });
  if (error) {
    sendError(ws, "CREATE_GROUP_FAILED", error);
    return;
  }
  releaseStaleIdentity(prevInfo);
  sendTo(ws, { type: "group_joined", playerId, groupCode: group.code, group: getGroupPublicState(group) });
}

function joinGroup(ws: WS, msg: Extract<ClientMessage, { type: "join_group" }>): void {
  const prevInfo = clients.get(ws);
  const { group, playerId, error } = groupService.joinGroup(ws, {
    code: msg.code,
    playerName: msg.playerName,
    groupName: msg.groupName,
  });
  if (error) {
    sendError(ws, "JOIN_GROUP_FAILED", error);
    return;
  }
  releaseStaleIdentity(prevInfo);
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

    // Same re-check as the standalone-room rejoin (see roomHandlers.rejoin):
    // reconnecting can be exactly what a phase was waiting on.
    const engine = getEngine(instance.gameType);
    engine?.maybeAdvance(instance);

    sendTo(ws, { type: "joined", playerId, roomCode: instance.code, room: getRoomPublicState(instance) });
    if (instance.round) sendPrivateInfo(ws, instance, playerId);
    broadcast(instance.code, { type: "state", room: getRoomPublicState(instance) }, ws);
    if (instance.phase === "result") broadcastRoundReveal(instance);
    syncPhaseTimer(instance);
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

// Host-only: removes a member from the group entirely. Same "leave whatever
// instance they're in first" step as leaveGroup, since a member expelled from
// the group shouldn't keep sitting in one of its open instances.
function kickMember(ws: WS, msg: Extract<ClientMessage, { type: "kick_member" }>, info: ClientInfo): void {
  const group = groups.get(info.groupCode ?? "");
  if (!group || group.hostId !== info.playerId || msg.targetId === info.playerId) return;
  if (!group.members.some(m => m.id === msg.targetId)) return;

  for (const [ws2, i2] of clients) {
    if (i2.groupCode === group.code && i2.roomCode && i2.playerId === msg.targetId) {
      leavePlayerFromInstance(i2.roomCode, msg.targetId, group);
      break;
    }
  }

  groupService.leaveGroup(group, msg.targetId);
  logger.info({ groupCode: group.code, targetId: msg.targetId, byHostId: info.playerId }, "member kicked from group");

  for (const [ws2, i2] of clients) {
    if (i2.playerId === msg.targetId) {
      clients.set(ws2, { groupCode: null, roomCode: null, playerId: msg.targetId });
      sendTo(ws2, { type: "kicked_from_group" });
    }
  }

  if (group.members.length === 0) groups.delete(group.code);
  else broadcastGroupState(group);
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
  }, PLAYER_OFFLINE_TIMEOUT_MS).unref();
}

// Mirrors roomHandlers.ts's PLAYER_OFFLINE_TIMEOUT_MS — kept as a separate
// constant so this file has no dependency on that one, but intentionally the
// same value (see roomHandlers.ts for the full rationale).
const PLAYER_OFFLINE_TIMEOUT_MS = 5 * 60 * 1000;

module.exports = {
  createGroup,
  joinGroup,
  rejoinGroup,
  createInstance,
  joinInstance,
  leaveInstance,
  leaveGroup,
  kickMember,
  leavePlayerFromInstance,
  scheduleGroupMemberKick,
};
