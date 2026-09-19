// ─── Group Service ───────────────────────────────────────────────────────────
// A group is a persistent lobby (its own code, its own member roster) that
// can have several game instances (see roomService.ts's Room) open under it
// at once. Anyone in the group can open one; each member decides on their
// own whether to join it. This file owns group membership only — creating
// an instance under a group, or a member joining/leaving one, is handled by
// combining this with roomService (see ws/handlers.ts's group_* handlers).

import type { Group } from "@juntada/shared-types";
import type { WebSocket } from "ws";
import type { ClientInfo } from "../state/roomStore";
import { logger } from "../logger";

const { v4: uuidv4 } = require("uuid");
const { groups, clients, activeSockets, evictPreviousAccountSocket } = require("../state/roomStore") as {
  groups: Map<string, Group>;
  clients: Map<WebSocket, ClientInfo>;
  activeSockets: Map<string, WebSocket>;
  evictPreviousAccountSocket: (scopeCode: string, accountId: string, newWs: WebSocket) => void;
};
const { generateUniqueRoomCode } = require("./roomCode") as { generateUniqueRoomCode: () => string };
const { ONLINE_CLEANUP_DELAY_MS } = require("./constants") as { ONLINE_CLEANUP_DELAY_MS: number };
const { pickHostReplacement } = require("./rosterUtils") as {
  pickHostReplacement: (roster: { id: string; name: string; online: boolean }[], leavingId: string) => { id: string } | undefined;
};

const MAX_MEMBERS_PER_GROUP = 16;
const MAX_TOTAL_GROUPS = 500;

interface GroupResult {
  group?: Group;
  playerId?: string;
  error?: string;
}

function createGroup(
  ws: WebSocket,
  { accountId, username, groupName }: { accountId: string; username: string; groupName?: string },
): GroupResult {
  if (groups.size >= MAX_TOTAL_GROUPS) return { error: "El servidor está lleno, probá de nuevo en un rato" };

  const code = generateUniqueRoomCode();
  const playerId: string = uuidv4();
  const group: Group = {
    code,
    name: groupName || "Grupo sin nombre",
    hostId: playerId,
    members: [{ id: playerId, accountId, name: username, online: true }],
    chat: [],
  };
  groups.set(code, group);
  clients.set(ws, { groupCode: code, roomCode: null, playerId, accountId });
  activeSockets.set(playerId, ws);
  evictPreviousAccountSocket(code, accountId, ws);
  logger.info({ groupCode: code, memberCount: groups.size }, "group created");
  return { group, playerId };
}

function joinGroup(
  ws: WebSocket,
  { code, accountId, username, groupName }: { code?: string; accountId: string; username: string; groupName?: string },
): GroupResult {
  const group = groups.get(code?.toUpperCase() ?? "");
  if (!group) return { error: "No existe ningún grupo con ese código" };
  // The join form asks for the group's name alongside its code (not just the
  // code alone) so a mistyped/mismatched code that happens to hit a real,
  // unrelated group fails loudly here instead of dropping the player into
  // the wrong group.
  if (groupName?.trim() && groupName.trim().toLowerCase() !== group.name.toLowerCase()) {
    return { error: "El nombre no coincide con el grupo de ese código" };
  }
  const existingMember = group.members.find(m => m.accountId === accountId);
  if (existingMember) {
    existingMember.online = true;
    clients.set(ws, { groupCode: group.code, roomCode: null, playerId: existingMember.id, accountId });
    activeSockets.set(existingMember.id, ws);
    evictPreviousAccountSocket(group.code, accountId, ws);
    return { group, playerId: existingMember.id };
  }
  if (group.members.length >= MAX_MEMBERS_PER_GROUP) return { error: "El grupo está lleno" };

  const playerId: string = uuidv4();
  group.members.push({ id: playerId, accountId, name: username, online: true });
  clients.set(ws, { groupCode: group.code, roomCode: null, playerId, accountId });
  activeSockets.set(playerId, ws);
  evictPreviousAccountSocket(group.code, accountId, ws);
  return { group, playerId };
}

// Restores membership after a dropped socket, resolved purely from the
// authenticated `accountId` — no client-supplied playerId anymore (see
// design.md's account-reconnection delta). Doesn't restore which instance
// (if any) the player was attached to — the caller (ws/handlers.ts)
// re-derives that by checking whether any room still lists this playerId.
function rejoinGroup(ws: WebSocket, { groupCode, accountId }: { groupCode: string; accountId: string }): GroupResult {
  const group = groups.get(groupCode);
  if (!group) return { error: "El grupo ya no existe" };
  const member = group.members.find(m => m.accountId === accountId);
  if (!member) return { error: "Ya no formás parte de este grupo" };
  member.online = true;
  clients.set(ws, { groupCode: group.code, roomCode: null, playerId: member.id, accountId });
  activeSockets.set(member.id, ws);
  evictPreviousAccountSocket(group.code, accountId, ws);
  return { group, playerId: member.id };
}

// A member choosing to leave the group entirely (not just an instance under
// it) — removes them from the roster. Doesn't touch any instance they might
// currently be attached to; the caller (ws/handlers.ts) leaves that instance
// first, same as switching instances does.
function leaveGroup(group: Group, playerId: string): void {
  group.members = group.members.filter(m => m.id !== playerId);
  if (group.hostId === playerId) {
    // playerId is already gone from group.members by this point, so
    // pickHostReplacement only ever returns undefined here when the group
    // is now empty outright — same as roomService's reassignHostIfNeeded,
    // which leaves hostId as-is in that case too (the group/room is about
    // to be deleted by the caller either way, see leaveGroup's callers).
    const candidate = pickHostReplacement(group.members, playerId);
    if (candidate) group.hostId = candidate.id;
  }
}

function markMemberOffline(group: Group, playerId: string): void {
  const m = group.members.find(m => m.id === playerId);
  if (m) m.online = false;
}

function isGroupFullyOffline(group: Group): boolean {
  return group.members.every(m => !m.online);
}

function scheduleGroupCleanup(groupCode: string): void {
  // unref'd so this background grace-period timer never keeps the process
  // itself alive (matters for clean shutdown / tests) — the server process
  // otherwise stays up regardless, so the timer still fires normally.
  setTimeout(() => {
    const g = groups.get(groupCode);
    if (g && isGroupFullyOffline(g)) {
      groups.delete(groupCode);
      logger.info({ groupCode, remainingGroups: groups.size }, "group closed: fully offline past grace period");
    }
  }, ONLINE_CLEANUP_DELAY_MS).unref();
}

module.exports = {
  createGroup,
  joinGroup,
  rejoinGroup,
  leaveGroup,
  markMemberOffline,
  isGroupFullyOffline,
  scheduleGroupCleanup,
  MAX_MEMBERS_PER_GROUP,
};
