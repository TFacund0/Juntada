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
const roomService = require("../rooms/roomService");
const groupService = require("../rooms/groupService");

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
    broadcastStateAndPrivateInfo(r);
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

// The public "state" plus each player's own "private_role" — every place
// that changes a room's phase/round needs both (a phase change can hand a
// player fresh private info: a new secret word, a reassigned role, ...), so
// this is the one place that pairs them instead of every call site
// re-deriving the same two-message broadcast. Resolves the engine and the
// public state once per call (not once per player) — an N-player room used
// to redo both inside the per-client loop.
function broadcastStateAndPrivateInfo(room: Room): void {
  const engine = getEngine(room.gameType);
  const stateMessage = { type: "state" as const, room: getRoomPublicState(room) };
  broadcastToRoom(room, (ws2, i2) => {
    sendTo(ws2, stateMessage);
    if (!i2.playerId) return;
    const view = engine?.getPrivateView(room, i2.playerId);
    if (view) sendTo(ws2, { type: "private_role", ...view });
  });
}

// A player might just be flipping back to a chat app to answer a text, or
// lose signal for a few seconds — reacting to that instantly (see engines'
// optional onPlayerOffline, e.g. skipping whoever's turn it is) would punish
// a normal, brief disconnect the same as someone who's actually gone. This
// gives them real time to come back before it costs them anything, while
// still being far shorter than the 10-minute grace period before an offline
// player is auto-kicked outright (schedulePlayerKick, ./roomHandlers.ts) —
// that one only ever removes them from the room; this one only ever reacts
// to them still being mid-turn.
const OFFLINE_REACTION_DELAY_MS = 60 * 1000;

// How long a single disconnected player is allowed to sit offline (while
// others in the room/group stay connected) before being auto-removed, so
// one dropped connection doesn't keep holding up the game or cluttering the
// group's roster indefinitely. Whole-room/whole-group cleanup (see
// scheduleRoomCleanup/scheduleGroupCleanup) already handles the case where
// everyone is offline, so this only ever fires while someone else is still
// around to keep playing without the disconnected player in the way. Shared
// by roomHandlers.ts's schedulePlayerKick and groupHandlers.ts's
// scheduleGroupMemberKick.
const PLAYER_OFFLINE_TIMEOUT_MS = 10 * 60 * 1000;

// Keyed by "roomCode:playerId" — a flaky connection can disconnect and
// reconnect several times within OFFLINE_REACTION_DELAY_MS while a round is
// live, and unlike syncPhaseTimer's single `timers` slot per room, each call
// used to just fire a bare setTimeout with nothing tracking it. That let
// several of these stack up for the same player, so if they ended up
// actually offline when the first one fired, every later duplicate fired
// engine.onPlayerOffline again too — most engines happen to no-op a repeat
// call today (the turn's already moved on), but nothing guarantees that for
// a future engine.
const offlineReactionTimers = new Map<string, NodeJS.Timeout>();

function scheduleOfflineReaction(roomCode: string, playerId: string): void {
  const key = `${roomCode}:${playerId}`;
  const existing = offlineReactionTimers.get(key);
  if (existing) clearTimeout(existing);

  const t = setTimeout(() => {
    offlineReactionTimers.delete(key);
    const room = rooms.get(roomCode);
    if (!room) return;
    const player = room.players.find(p => p.id === playerId);
    // Reconnected (or left the room entirely) before the grace period ran
    // out — either way, nothing to react to anymore.
    if (!player || player.online) return;
    const engine = getEngine(room.gameType);
    engine?.onPlayerOffline?.(room, playerId);
    broadcastToRoom(room, ws2 => sendTo(ws2, { type: "state", room: getRoomPublicState(room) }));
    if (room.phase === "result") broadcastRoundReveal(room);
    syncPhaseTimer(room);
  }, OFFLINE_REACTION_DELAY_MS);
  t.unref();
  offlineReactionTimers.set(key, t);
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

// A fresh create_room/join_room/create_group/join_group always mints a brand
// new playerId for this socket — but if the socket already held a *different*
// identity (a room and/or group it never explicitly left, e.g. the client
// lost its saved playerId and re-joined under a new name instead of
// rejoining), that old identity would otherwise sit in room.players/
// group.members forever: still "online" (nothing ever closes its socket,
// since this same socket just switched to representing someone else), taking
// up a player slot, and permanently counted in "every online player"
// gates — exactly the "two accounts connected, only one actually used" bug.
//
// Takes the *previously captured* ClientInfo rather than reading `clients`
// itself — callers must snapshot it before calling create_room/join_room/
// etc (which overwrite the socket's entry immediately on success), and must
// only call this once that call has actually succeeded. Releasing on a
// failed join (bad code, room full, ...) would strand the caller with
// neither their old identity nor a new one.
function releaseStaleIdentity(info: ClientInfo | undefined): void {
  if (!info?.playerId) return;

  if (info.roomCode) {
    const room = rooms.get(info.roomCode);
    if (room) {
      roomService.removePlayer(room, info.playerId);
      const engine = getEngine(room.gameType);
      engine?.maybeAdvance(room);
      if (room.players.length === 0) {
        cleanupRoomIfEmpty(room);
      } else {
        broadcastToRoom(room, ws2 => sendTo(ws2, { type: "state", room: getRoomPublicState(room) }));
        if (room.phase === "result") broadcastRoundReveal(room);
        syncPhaseTimer(room);
        if (room.groupCode) {
          const group = groups.get(room.groupCode);
          if (group) broadcastGroupState(group);
        }
      }
    }
  }

  if (info.groupCode) {
    const group = groups.get(info.groupCode);
    if (group) {
      groupService.leaveGroup(group, info.playerId);
      if (group.members.length === 0) groups.delete(group.code);
      else broadcastGroupState(group);
    }
  }
}

module.exports = {
  stopTimer,
  syncPhaseTimer,
  broadcastToRoom,
  broadcastStateAndPrivateInfo,
  cleanupRoomIfEmpty,
  releaseStaleIdentity,
  scheduleOfflineReaction,
  PLAYER_OFFLINE_TIMEOUT_MS,
};
