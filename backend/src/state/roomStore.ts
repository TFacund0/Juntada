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

// The socket currently "owned" by each playerId. A dropped connection's
// close event can fire well after the client has already reconnected on a
// brand-new socket (rejoin/join processed first) — without this, that late
// close event would run disconnect bookkeeping (markOffline, schedulePlayerKick)
// for a player who is, in fact, already back online, silently dropping them
// back out of any "every online player" gate (ready/vote/confirm counts).
// Every place that binds a playerId to a socket (join, rejoin, create, ...)
// claims ownership here; ws/handlers.ts's handleDisconnect checks it before
// treating a close event as a real disconnect.
const activeSockets = new Map<string, WebSocket>();

module.exports = { groups, rooms, clients, timers, activeSockets };
