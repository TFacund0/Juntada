// ─── State ────────────────────────────────────────────────────────────────────
// In-memory store for rooms, connected clients and pending round timers.
// Kept isolated so the WS transport layer never touches raw Maps directly.

import type { WebSocket } from "ws";
import type { Room } from "@juntada/shared-types";

export interface ClientInfo {
  roomCode: string | null;
  playerId: string | null;
}

const rooms = new Map<string, Room>();
const clients = new Map<WebSocket, ClientInfo>();
const timers = new Map<string, NodeJS.Timeout>();

module.exports = { rooms, clients, timers };
