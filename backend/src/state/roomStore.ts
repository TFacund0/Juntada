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
  // The authenticated account's id (JWT `sub`), verified once at the WS
  // handshake (see ws/server.ts) and trusted for the lifetime of the
  // connection — never re-derived from client-supplied data. Only null for
  // a socket that somehow never went through the handshake check (shouldn't
  // happen in practice; the handshake closes anything without a valid JWT
  // before it's ever added to `clients`).
  accountId: string | null;
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

// Multi-device policy (see design.md "Second socket on same account"): the
// newest socket for a given account always wins. Keyed by `${scopeCode}:
// ${accountId}` where scopeCode is a room or group code, so the same account
// can independently hold one active socket in a room and one on a group
// screen without either evicting the other. roomService.ts/groupService.ts
// call evictPreviousAccountSocket whenever a socket successfully binds to an
// accountId within a room/group (create/join/rejoin).
const accountSockets = new Map<string, WebSocket>();

function evictPreviousAccountSocket(scopeCode: string, accountId: string, newWs: WebSocket): void {
  const key = `${scopeCode}:${accountId}`;
  const prev = accountSockets.get(key);
  if (prev && prev !== newWs) {
    try {
      prev.close(4001, "session_replaced");
    } catch {
      // Already closed/closing — nothing left to evict.
    }
  }
  accountSockets.set(key, newWs);
}

module.exports = { groups, rooms, clients, timers, activeSockets, accountSockets, evictPreviousAccountSocket };
