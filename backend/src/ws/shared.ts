// ─── WS Handler Shared Helpers ──────────────────────────────────────────────
// Room-generic helpers used by both roomHandlers.ts and groupHandlers.ts
// (an instance opened under a group is still just a Room underneath). Kept
// separate so neither handler module has to import from the other.

import type { Room, Group } from "@juntada/shared-types";
import type { ClientInfo } from "../state/roomStore";
import type { GameEngine } from "../games/engineTypes";

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
const { sendTo, getRoomPublicState, broadcastGroupState, broadcastRoundReveal } = require("./messaging");

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

module.exports = { stopTimer, syncPhaseTimer, broadcastToRoom, cleanupRoomIfEmpty };
