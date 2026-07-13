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
const { groups, clients } = require("../state/roomStore") as {
  groups: Map<string, Group>;
  clients: Map<WebSocket, ClientInfo>;
};
const { generateUniqueRoomCode } = require("./roomCode") as { generateUniqueRoomCode: () => string };

const ONLINE_CLEANUP_DELAY_MS = 5 * 60 * 1000;
const MAX_MEMBERS_PER_GROUP = 16;
const MAX_TOTAL_GROUPS = 500;

interface GroupResult {
  group?: Group;
  playerId?: string;
  error?: string;
}

function createGroup(ws: WebSocket, { playerName, groupName }: { playerName?: string; groupName?: string }): GroupResult {
  if (groups.size >= MAX_TOTAL_GROUPS) return { error: "El servidor está lleno, probá de nuevo en un rato" };

  const code = generateUniqueRoomCode();
  const playerId: string = uuidv4();
  const group: Group = {
    code,
    name: groupName || "Grupo sin nombre",
    hostId: playerId,
    members: [{ id: playerId, name: playerName || "Anfitrión", online: true }],
  };
  groups.set(code, group);
  clients.set(ws, { groupCode: code, roomCode: null, playerId });
  logger.info({ groupCode: code, memberCount: groups.size }, "group created");
  return { group, playerId };
}

function isNameTaken(group: Group, name: string): boolean {
  return group.members.some(m => m.name.toLowerCase() === name.toLowerCase());
}

function joinGroup(ws: WebSocket, { code, playerName }: { code?: string; playerName?: string }): GroupResult {
  const group = groups.get(code?.toUpperCase() ?? "");
  if (!group) return { error: "No existe ningún grupo con ese código" };
  if (group.members.length >= MAX_MEMBERS_PER_GROUP) return { error: "El grupo está lleno" };

  const name = playerName || "Jugador";
  if (isNameTaken(group, name)) return { error: "Ese nombre ya está en uso en este grupo" };

  const playerId: string = uuidv4();
  group.members.push({ id: playerId, name, online: true });
  clients.set(ws, { groupCode: group.code, roomCode: null, playerId });
  return { group, playerId };
}

// Restores membership after a dropped socket. Doesn't restore which
// instance (if any) the player was attached to — the caller (ws/handlers.ts)
// re-derives that by checking whether any room still lists this playerId.
function rejoinGroup(ws: WebSocket, { groupCode, playerId }: { groupCode: string; playerId: string }): GroupResult {
  const group = groups.get(groupCode);
  if (!group) return { error: "El grupo ya no existe" };
  const member = group.members.find(m => m.id === playerId);
  if (!member) return { error: "Ya no formás parte de este grupo" };
  member.online = true;
  clients.set(ws, { groupCode: group.code, roomCode: null, playerId });
  return { group, playerId };
}

function markMemberOffline(group: Group, playerId: string): void {
  const m = group.members.find(m => m.id === playerId);
  if (m) m.online = false;
}

function isGroupFullyOffline(group: Group): boolean {
  return group.members.every(m => !m.online);
}

function scheduleGroupCleanup(groupCode: string): void {
  setTimeout(() => {
    const g = groups.get(groupCode);
    if (g && isGroupFullyOffline(g)) {
      groups.delete(groupCode);
      logger.info({ groupCode, remainingGroups: groups.size }, "group closed: fully offline past grace period");
    }
  }, ONLINE_CLEANUP_DELAY_MS);
}

module.exports = {
  createGroup,
  joinGroup,
  rejoinGroup,
  markMemberOffline,
  isGroupFullyOffline,
  scheduleGroupCleanup,
  MAX_MEMBERS_PER_GROUP,
};
