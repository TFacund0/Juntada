// ─── State ────────────────────────────────────────────────────────────────────
// In-memory store for groups, game instances (rooms), connected clients and
// pending round timers. Kept isolated so the WS transport layer never
// touches raw Maps directly.

import type { WebSocket } from "ws";
import type { Room, Group } from "@juntada/shared-types";

export interface ClientInfo {
  // A client is either in a group (groupCode set, roomCode is whichever
  // instance under it they're currently attached to, or null while just
  // browsing the group screen) or in a single standalone room created
  // without a group (roomCode set, groupCode null) — never both concepts
  // populated in a way that conflicts.
  groupCode: string | null;
  roomCode: string | null;
  playerId: string | null;
}

const groups = new Map<string, Group>();
const rooms = new Map<string, Room>();
const clients = new Map<WebSocket, ClientInfo>();
const timers = new Map<string, NodeJS.Timeout>();

module.exports = { groups, rooms, clients, timers };
