// React-free inbound message dispatch table for the multiplayer socket hook.
// Every handler here is a pure function over an injected `ctx` port (see
// `InboundMessageContext` below) instead of closing over hook state directly
// — that's what lets each one be unit-tested with a plain spy object, no
// React renderer/hook harness required. `useMultiplayerSocket.ts` still owns
// wiring `ctx` from its own state/refs; this module only owns "given this
// message and this port, what happens".
//
// Behavior here is a line-for-line port of the previous inline
// `handleInboundMessage` in useMultiplayerSocket.ts — no behavior change is
// intended in this slice (see spec's "Composition root" / "Opportunistic
// edge-case fix disclosed" scenarios for how a deliberate fix would be
// called out instead).
import type { RoomPublicState, GroupPublicState, ServerMessage } from "@juntada/shared-types";
import type { RoomSession, GroupSession } from "./multiplayerSession";

// Result of the join screen's live "check_room_code" lookup — mirrors the
// shape of the same-named type in useMultiplayerSocket.ts (kept local here
// so this module has zero dependency on the hook layer; the two will be
// unified once the hook delegates to this module in a later slice).
export interface RoomPreview {
  code: string;
  found: boolean;
  name?: string;
  gameType?: string;
  isGroupCode?: boolean;
}

// The server messages this dispatcher reacts to — same set/shape as the
// pre-refactor inline union in useMultiplayerSocket.ts.
export type InboundMessage =
  | Extract<ServerMessage, { type: "joined" }>
  | Extract<ServerMessage, { type: "state" }>
  | Extract<ServerMessage, { type: "group_joined" }>
  | Extract<ServerMessage, { type: "group_state" }>
  | Extract<ServerMessage, { type: "left_instance" }>
  | Extract<ServerMessage, { type: "left_group" }>
  | { type: "private_role"; [key: string]: unknown }
  | { type: "word_reveal"; [key: string]: unknown }
  | Extract<ServerMessage, { type: "error" }>
  | Extract<ServerMessage, { type: "kicked" }>
  | Extract<ServerMessage, { type: "kicked_from_group" }>
  | Extract<ServerMessage, { type: "room_preview" }>;

// The port every handler is written against — grouped by owning unit per
// the design doc so it stays obvious which future hook (session, overlay,
// or the composition root itself) a given member will be wired from.
export interface InboundMessageContext {
  // from useMultiplayerSession
  setMe(s: RoomSession | null): void;
  setGroupMe(s: GroupSession | null): void;
  readMe(): RoomSession | null;
  readGroupMe(): GroupSession | null;
  readGroupSessionEnabled(): boolean;
  // from the composition root
  setConnectionPhase(next: string | ((prev: string) => string)): void;
  setRoom(r: RoomPublicState | null): void;
  setGroup(g: GroupPublicState | null): void;
  setMyRole(r: Record<string, unknown> | null): void;
  setWordReveal(w: Record<string, unknown> | null): void;
  setRoomPreview(p: RoomPreview): void;
  readRoom(): RoomPublicState | null;
  notifyLeftGroup(): void;
  // from useReconnectOverlay
  isColdStart(): boolean;
  onReconnected(): void;
  resolveColdStart(phase?: string): void;
  settleGroupColdStart(): void;
  cancelJoinFallbacks(): void;
  scheduleGroupPhaseFallback(): void;
  endColdStart(): void;
  markSessionGone(): void;
  stopReconnecting(): void;
  abandonReconnect(): void;
  // from useFlashError
  flashError(message: string): void;
  clearError(): void;
}

export function parseInboundMessage(raw: string): InboundMessage | null {
  try {
    return JSON.parse(raw) as InboundMessage;
  } catch {
    return null;
  }
}

// Line-380-equivalent guard: true when this connection never landed in a
// room, nor in a group session this screen actually cares about (see
// groupSessionEnabled in useMultiplayerSocket.ts for why the enabled flag
// gates the group check).
export function neverJoinedAnything(ctx: InboundMessageContext): boolean {
  return !ctx.readRoom() && !(ctx.readGroupSessionEnabled() && ctx.readGroupMe());
}

// A joiner held in room.waitingPlayers (see roomService.joinRoom) is
// invisible to the game engine — the round's real phase from the server
// would otherwise land them on a RoundScreen built for an actual
// participant (myPlayer, myRole, ... all undefined for them). Rendering
// "waiting" instead lets MultiplayerGame show a dedicated screen until the
// server flushes them into `players` once the round ends and the phase goes
// back to "lobby".
function effectivePhase(room: RoomPublicState, playerId: string | undefined): string {
  if (playerId && (room.waitingPlayers ?? []).some(p => p.id === playerId)) return "waiting";
  return room.phase;
}

export function handleJoined(msg: Extract<InboundMessage, { type: "joined" }>, ctx: InboundMessageContext): void {
  ctx.cancelJoinFallbacks();
  ctx.setMe({ playerId: msg.playerId, roomCode: msg.roomCode });
  ctx.setRoom(msg.room);
  const phase = effectivePhase(msg.room, msg.playerId);
  ctx.setConnectionPhase(phase);
  ctx.clearError();
  ctx.onReconnected();
  ctx.resolveColdStart(phase);
}

export function handleState(msg: Extract<InboundMessage, { type: "state" }>, ctx: InboundMessageContext): void {
  ctx.setRoom(msg.room);
  const phase = effectivePhase(msg.room, ctx.readMe()?.playerId);
  ctx.setConnectionPhase(phase);
  ctx.clearError();
  ctx.onReconnected();
  ctx.resolveColdStart(phase);
}

export function handleGroupJoined(msg: Extract<InboundMessage, { type: "group_joined" }>, ctx: InboundMessageContext): void {
  ctx.setGroupMe({ playerId: msg.playerId, groupCode: msg.groupCode });
  ctx.setGroup(msg.group);
  // A rejoin_group may be immediately followed by a "joined" for a still-live
  // instance — don't force the group screen if that's about to happen. A
  // plain group_joined from the group screen itself has no remembered room
  // (readMe() is null), so it resolves immediately; a hot reconnect that
  // still remembers a room waits for "joined" instead of flashing the group
  // screen.
  if (!ctx.readRoom() && !ctx.readMe()) {
    ctx.setConnectionPhase("group");
  } else if (!ctx.readRoom()) {
    ctx.scheduleGroupPhaseFallback();
  }
  ctx.clearError();
  ctx.onReconnected();
  ctx.settleGroupColdStart();
}

export function handleGroupState(msg: Extract<InboundMessage, { type: "group_state" }>, ctx: InboundMessageContext): void {
  ctx.setGroup(msg.group);
  ctx.clearError();
  ctx.onReconnected();
  ctx.settleGroupColdStart();
}

export function handleLeftInstance(ctx: InboundMessageContext): void {
  ctx.setMe(null);
  ctx.setRoom(null);
  ctx.setMyRole(null);
  ctx.setWordReveal(null);
  ctx.setConnectionPhase("group");
  ctx.clearError();
}

export function handleLeftGroup(ctx: InboundMessageContext): void {
  ctx.setMe(null);
  ctx.setRoom(null);
  ctx.setGroupMe(null);
  ctx.setGroup(null);
  ctx.setMyRole(null);
  ctx.setWordReveal(null);
  ctx.setConnectionPhase("menu");
  ctx.clearError();
  ctx.notifyLeftGroup();
}

export function handlePrivateRole(msg: Extract<InboundMessage, { type: "private_role" }>, ctx: InboundMessageContext): void {
  ctx.setMyRole(msg);
  ctx.setWordReveal(null);
}

export function handleWordReveal(msg: Extract<InboundMessage, { type: "word_reveal" }>, ctx: InboundMessageContext): void {
  ctx.setWordReveal(msg);
}

export function handleError(msg: Extract<InboundMessage, { type: "error" }>, ctx: InboundMessageContext): void {
  if (msg.code === "REJOIN_FAILED" || msg.code === "REJOIN_GROUP_FAILED") {
    // The room/group this session pointed at is gone. Two very different
    // situations share this error code:
    //   - a live drop reconnecting mid-session (the player was actively in
    //     the room/group when it vanished) — worth an explicit "gone"
    //     overlay, since dropping them silently would be disorienting.
    //   - a silent background auto-rejoin on mount (coldStart), from a
    //     session left over in localStorage from a much earlier visit whose
    //     room/group was already cleaned up server-side — the player never
    //     asked to reconnect to anything, so blocking their "crear sala
    //     nueva" flow with a "ya no existe" screen makes no sense. Just
    //     forget the stale session and let them land on the normal menu.
    if (ctx.isColdStart()) {
      ctx.setMe(null);
      ctx.setRoom(null);
      ctx.setGroupMe(null);
      ctx.setGroup(null);
      ctx.setConnectionPhase("menu");
      ctx.endColdStart();
    } else {
      ctx.flashError(msg.message);
      // Deliberately doesn't clear me/groupMe here (that's what tells the
      // "gone" overlay whether to say "sala" or "grupo") — the actual
      // session/localStorage cleanup happens once the player dismisses it
      // via leave().
      ctx.markSessionGone();
    }
    ctx.abandonReconnect();
  } else if (neverJoinedAnything(ctx)) {
    // Failed before ever landing in a room/group — a fresh join with a bad
    // code, typed by the user on the join screen. Never leave the UI stuck:
    // drop the stale session and send them back to the menu instead of an
    // infinite "Conectando..." with nothing to rejoin.
    ctx.flashError(msg.message);
    ctx.setMe(null);
    ctx.setRoom(null);
    ctx.setConnectionPhase(prev => (prev === "menu" || prev === "create" || prev === "join" ? prev : "join"));
    ctx.endColdStart();
  } else {
    ctx.flashError(msg.message);
    ctx.endColdStart();
  }
}

export function handleRoomPreview(msg: Extract<InboundMessage, { type: "room_preview" }>, ctx: InboundMessageContext): void {
  ctx.setRoomPreview(msg as unknown as RoomPreview);
}

export function handleKicked(ctx: InboundMessageContext): void {
  ctx.setConnectionPhase(ctx.readGroupMe() ? "group" : "menu");
  ctx.setMe(null);
  ctx.setRoom(null);
  ctx.setMyRole(null);
  ctx.flashError("Fuiste expulsado de la sala");
  ctx.stopReconnecting();
  ctx.endColdStart();
}

export function handleKickedFromGroup(ctx: InboundMessageContext): void {
  ctx.setMe(null);
  ctx.setRoom(null);
  ctx.setGroupMe(null);
  ctx.setGroup(null);
  ctx.setMyRole(null);
  ctx.setWordReveal(null);
  ctx.setConnectionPhase("menu");
  ctx.flashError("Fuiste expulsado del grupo");
  ctx.stopReconnecting();
  ctx.notifyLeftGroup();
  ctx.endColdStart();
}

const handlers: { [K in InboundMessage["type"]]: (msg: Extract<InboundMessage, { type: K }>, ctx: InboundMessageContext) => void } = {
  joined: handleJoined,
  state: handleState,
  group_joined: handleGroupJoined,
  group_state: handleGroupState,
  left_instance: (_msg, ctx) => handleLeftInstance(ctx),
  left_group: (_msg, ctx) => handleLeftGroup(ctx),
  private_role: handlePrivateRole,
  word_reveal: handleWordReveal,
  error: handleError,
  room_preview: handleRoomPreview,
  kicked: (_msg, ctx) => handleKicked(ctx),
  kicked_from_group: (_msg, ctx) => handleKickedFromGroup(ctx),
};

export function dispatchInboundMessage(msg: InboundMessage, ctx: InboundMessageContext): void {
  const handler = handlers[msg.type as InboundMessage["type"]];
  if (handler) handler(msg as never, ctx);
}
