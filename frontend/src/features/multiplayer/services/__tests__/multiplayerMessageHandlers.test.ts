import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseInboundMessage,
  dispatchInboundMessage,
  neverJoinedAnything,
  handleJoined,
  handleState,
  handleGroupJoined,
  handleGroupState,
  handleLeftInstance,
  handleLeftGroup,
  handlePrivateRole,
  handleWordReveal,
  handleError,
  handleRoomPreview,
  handleKicked,
  handleKickedFromGroup,
  type InboundMessageContext,
} from "../multiplayerMessageHandlers";

// A fully-spied ctx — every handler test only asserts on the specific
// members it cares about, but every field must exist since handlers call
// them unconditionally in some branches.
function makeCtx(overrides: Partial<InboundMessageContext> = {}): InboundMessageContext {
  return {
    setMe: vi.fn(),
    setGroupMe: vi.fn(),
    readMe: vi.fn(() => null),
    readGroupMe: vi.fn(() => null),
    readGroupSessionEnabled: vi.fn(() => true),
    setConnectionPhase: vi.fn(),
    setRoom: vi.fn(),
    setGroup: vi.fn(),
    setMyRole: vi.fn(),
    setWordReveal: vi.fn(),
    setRoomPreview: vi.fn(),
    readRoom: vi.fn(() => null),
    notifyLeftGroup: vi.fn(),
    isColdStart: vi.fn(() => false),
    onReconnected: vi.fn(),
    resolveColdStart: vi.fn(),
    settleGroupColdStart: vi.fn(),
    cancelJoinFallbacks: vi.fn(),
    scheduleGroupPhaseFallback: vi.fn(),
    endColdStart: vi.fn(),
    markSessionGone: vi.fn(),
    stopReconnecting: vi.fn(),
    abandonReconnect: vi.fn(),
    flashError: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

describe("parseInboundMessage", () => {
  it("parses valid JSON into the message", () => {
    expect(parseInboundMessage('{"type":"left_instance"}')).toEqual({ type: "left_instance" });
  });

  it("returns null on malformed JSON instead of throwing", () => {
    expect(parseInboundMessage("{not-json")).toBeNull();
  });
});

describe("neverJoinedAnything", () => {
  it("is true when neither a room nor an enabled group session exists", () => {
    const ctx = makeCtx({ readRoom: vi.fn(() => null), readGroupSessionEnabled: vi.fn(() => false), readGroupMe: vi.fn(() => null) });
    expect(neverJoinedAnything(ctx)).toBe(true);
  });

  it("is false when a room exists", () => {
    const ctx = makeCtx({ readRoom: vi.fn(() => ({}) as never) });
    expect(neverJoinedAnything(ctx)).toBe(false);
  });

  it("is false when group sessions are enabled and a group session exists", () => {
    const ctx = makeCtx({ readGroupSessionEnabled: vi.fn(() => true), readGroupMe: vi.fn(() => ({ playerId: "p", groupCode: "G" })) });
    expect(neverJoinedAnything(ctx)).toBe(false);
  });

  it("is true when a group session exists but group sessions are disabled for this screen", () => {
    const ctx = makeCtx({ readGroupSessionEnabled: vi.fn(() => false), readGroupMe: vi.fn(() => ({ playerId: "p", groupCode: "G" })) });
    expect(neverJoinedAnything(ctx)).toBe(true);
  });
});

describe("handleJoined", () => {
  it("cancels join fallbacks, sets room/session state, clears the error, and resolves cold start", () => {
    const ctx = makeCtx();
    const msg = { type: "joined" as const, playerId: "p1", roomCode: "ABCD", room: { phase: "lobby" } as never };
    handleJoined(msg, ctx);
    expect(ctx.cancelJoinFallbacks).toHaveBeenCalledTimes(1);
    expect(ctx.setMe).toHaveBeenCalledWith({ playerId: "p1", roomCode: "ABCD" });
    expect(ctx.setRoom).toHaveBeenCalledWith(msg.room);
    expect(ctx.setConnectionPhase).toHaveBeenCalledWith("lobby");
    expect(ctx.clearError).toHaveBeenCalledTimes(1);
    expect(ctx.onReconnected).toHaveBeenCalledTimes(1);
    expect(ctx.resolveColdStart).toHaveBeenCalledWith("lobby");
  });
});

describe("handleState", () => {
  it("updates room/phase, clears error, reconnects, and resolves cold start", () => {
    const ctx = makeCtx();
    const msg = { type: "state" as const, room: { phase: "voting" } as never };
    handleState(msg, ctx);
    expect(ctx.setRoom).toHaveBeenCalledWith(msg.room);
    expect(ctx.setConnectionPhase).toHaveBeenCalledWith("voting");
    expect(ctx.clearError).toHaveBeenCalledTimes(1);
    expect(ctx.onReconnected).toHaveBeenCalledTimes(1);
    expect(ctx.resolveColdStart).toHaveBeenCalledWith("voting");
  });
});

describe("handleGroupJoined", () => {
  it("moves straight to the group phase when there is no room and no remembered player", () => {
    const ctx = makeCtx({ readRoom: vi.fn(() => null), readMe: vi.fn(() => null) });
    const msg = { type: "group_joined" as const, playerId: "p1", groupCode: "WXYZ", group: {} as never };
    handleGroupJoined(msg, ctx);
    expect(ctx.setGroupMe).toHaveBeenCalledWith({ playerId: "p1", groupCode: "WXYZ" });
    expect(ctx.setGroup).toHaveBeenCalledWith(msg.group);
    expect(ctx.setConnectionPhase).toHaveBeenCalledWith("group");
    expect(ctx.scheduleGroupPhaseFallback).not.toHaveBeenCalled();
    expect(ctx.settleGroupColdStart).toHaveBeenCalledTimes(1);
  });

  it("schedules the group-phase fallback instead when a room is still expected", () => {
    const ctx = makeCtx({ readRoom: vi.fn(() => null), readMe: vi.fn(() => ({ playerId: "p1", roomCode: "ABCD" })) });
    const msg = { type: "group_joined" as const, playerId: "p1", groupCode: "WXYZ", group: {} as never };
    handleGroupJoined(msg, ctx);
    expect(ctx.setConnectionPhase).not.toHaveBeenCalled();
    expect(ctx.scheduleGroupPhaseFallback).toHaveBeenCalledTimes(1);
  });

  it("does nothing phase-wise when a room is already attached", () => {
    const ctx = makeCtx({ readRoom: vi.fn(() => ({}) as never), readMe: vi.fn(() => null) });
    const msg = { type: "group_joined" as const, playerId: "p1", groupCode: "WXYZ", group: {} as never };
    handleGroupJoined(msg, ctx);
    expect(ctx.setConnectionPhase).not.toHaveBeenCalled();
    expect(ctx.scheduleGroupPhaseFallback).not.toHaveBeenCalled();
  });
});

describe("handleGroupState", () => {
  it("updates group state, clears error, reconnects, and settles cold start", () => {
    const ctx = makeCtx();
    const msg = { type: "group_state" as const, group: {} as never };
    handleGroupState(msg, ctx);
    expect(ctx.setGroup).toHaveBeenCalledWith(msg.group);
    expect(ctx.clearError).toHaveBeenCalledTimes(1);
    expect(ctx.onReconnected).toHaveBeenCalledTimes(1);
    expect(ctx.settleGroupColdStart).toHaveBeenCalledTimes(1);
  });
});

describe("handleLeftInstance", () => {
  it("clears the instance and returns to the group phase", () => {
    const ctx = makeCtx();
    handleLeftInstance(ctx);
    expect(ctx.setMe).toHaveBeenCalledWith(null);
    expect(ctx.setRoom).toHaveBeenCalledWith(null);
    expect(ctx.setMyRole).toHaveBeenCalledWith(null);
    expect(ctx.setWordReveal).toHaveBeenCalledWith(null);
    expect(ctx.setConnectionPhase).toHaveBeenCalledWith("group");
    expect(ctx.clearError).toHaveBeenCalledTimes(1);
  });
});

describe("handleLeftGroup", () => {
  it("clears both sessions, returns to the menu, and notifies the caller", () => {
    const ctx = makeCtx();
    handleLeftGroup(ctx);
    expect(ctx.setMe).toHaveBeenCalledWith(null);
    expect(ctx.setRoom).toHaveBeenCalledWith(null);
    expect(ctx.setGroupMe).toHaveBeenCalledWith(null);
    expect(ctx.setGroup).toHaveBeenCalledWith(null);
    expect(ctx.setMyRole).toHaveBeenCalledWith(null);
    expect(ctx.setWordReveal).toHaveBeenCalledWith(null);
    expect(ctx.setConnectionPhase).toHaveBeenCalledWith("menu");
    expect(ctx.clearError).toHaveBeenCalledTimes(1);
    expect(ctx.notifyLeftGroup).toHaveBeenCalledTimes(1);
  });
});

describe("handlePrivateRole", () => {
  it("sets the role and clears any pending word reveal", () => {
    const ctx = makeCtx();
    const msg = { type: "private_role" as const, isImpostor: true };
    handlePrivateRole(msg, ctx);
    expect(ctx.setMyRole).toHaveBeenCalledWith(msg);
    expect(ctx.setWordReveal).toHaveBeenCalledWith(null);
  });
});

describe("handleWordReveal", () => {
  it("sets the word reveal payload", () => {
    const ctx = makeCtx();
    const msg = { type: "word_reveal" as const, word: "banana" };
    handleWordReveal(msg, ctx);
    expect(ctx.setWordReveal).toHaveBeenCalledWith(msg);
  });
});

describe("handleError", () => {
  describe("REJOIN_FAILED / REJOIN_GROUP_FAILED", () => {
    it("silently forgets a stale session and returns to the menu during a cold start", () => {
      const ctx = makeCtx({ isColdStart: vi.fn(() => true) });
      const msg = { type: "error" as const, code: "REJOIN_FAILED" as const, message: "gone" };
      handleError(msg, ctx);
      expect(ctx.setMe).toHaveBeenCalledWith(null);
      expect(ctx.setRoom).toHaveBeenCalledWith(null);
      expect(ctx.setGroupMe).toHaveBeenCalledWith(null);
      expect(ctx.setGroup).toHaveBeenCalledWith(null);
      expect(ctx.setConnectionPhase).toHaveBeenCalledWith("menu");
      expect(ctx.endColdStart).toHaveBeenCalledTimes(1);
      expect(ctx.flashError).not.toHaveBeenCalled();
      expect(ctx.markSessionGone).not.toHaveBeenCalled();
      expect(ctx.abandonReconnect).toHaveBeenCalledTimes(1);
    });

    it("flashes the error and marks the session gone for a live drop", () => {
      const ctx = makeCtx({ isColdStart: vi.fn(() => false) });
      const msg = { type: "error" as const, code: "REJOIN_GROUP_FAILED" as const, message: "el grupo ya no existe" };
      handleError(msg, ctx);
      expect(ctx.flashError).toHaveBeenCalledWith("el grupo ya no existe");
      expect(ctx.markSessionGone).toHaveBeenCalledTimes(1);
      expect(ctx.setMe).not.toHaveBeenCalled();
      expect(ctx.abandonReconnect).toHaveBeenCalledTimes(1);
    });
  });

  it("resets to the join form on a fresh join failure (never joined anything)", () => {
    const ctx = makeCtx({ readRoom: vi.fn(() => null), readGroupSessionEnabled: vi.fn(() => false), readGroupMe: vi.fn(() => null) });
    const msg = { type: "error" as const, code: "JOIN_ROOM_FAILED" as const, message: "no existe esa sala" };
    handleError(msg, ctx);
    expect(ctx.flashError).toHaveBeenCalledWith("no existe esa sala");
    expect(ctx.setMe).toHaveBeenCalledWith(null);
    expect(ctx.setRoom).toHaveBeenCalledWith(null);
    expect(ctx.endColdStart).toHaveBeenCalledTimes(1);
    const phaseUpdater = (ctx.setConnectionPhase as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(phaseUpdater("menu")).toBe("menu");
    expect(phaseUpdater("lobby")).toBe("join");
  });

  it("just flashes the error and ends cold start when already in something", () => {
    const ctx = makeCtx({ readRoom: vi.fn(() => ({}) as never) });
    const msg = { type: "error" as const, code: "VALIDATION_ERROR" as const, message: "algo salió mal" };
    handleError(msg, ctx);
    expect(ctx.flashError).toHaveBeenCalledWith("algo salió mal");
    expect(ctx.endColdStart).toHaveBeenCalledTimes(1);
    expect(ctx.setMe).not.toHaveBeenCalled();
  });
});

describe("handleRoomPreview", () => {
  it("sets the room preview", () => {
    const ctx = makeCtx();
    const msg = { type: "room_preview" as const, code: "ABCD", found: true };
    handleRoomPreview(msg, ctx);
    expect(ctx.setRoomPreview).toHaveBeenCalledWith(msg);
  });
});

describe("handleKicked", () => {
  it("returns to the group screen when a group session exists", () => {
    const ctx = makeCtx({ readGroupMe: vi.fn(() => ({ playerId: "p", groupCode: "G" })) });
    handleKicked(ctx);
    expect(ctx.setConnectionPhase).toHaveBeenCalledWith("group");
    expect(ctx.setMe).toHaveBeenCalledWith(null);
    expect(ctx.setRoom).toHaveBeenCalledWith(null);
    expect(ctx.setMyRole).toHaveBeenCalledWith(null);
    expect(ctx.flashError).toHaveBeenCalledWith("Fuiste expulsado de la sala");
    expect(ctx.stopReconnecting).toHaveBeenCalledTimes(1);
    expect(ctx.endColdStart).toHaveBeenCalledTimes(1);
  });

  it("returns to the menu when there is no group session", () => {
    const ctx = makeCtx({ readGroupMe: vi.fn(() => null) });
    handleKicked(ctx);
    expect(ctx.setConnectionPhase).toHaveBeenCalledWith("menu");
  });
});

describe("handleKickedFromGroup", () => {
  it("clears everything, returns to the menu, and notifies the caller", () => {
    const ctx = makeCtx();
    handleKickedFromGroup(ctx);
    expect(ctx.setMe).toHaveBeenCalledWith(null);
    expect(ctx.setRoom).toHaveBeenCalledWith(null);
    expect(ctx.setGroupMe).toHaveBeenCalledWith(null);
    expect(ctx.setGroup).toHaveBeenCalledWith(null);
    expect(ctx.setMyRole).toHaveBeenCalledWith(null);
    expect(ctx.setWordReveal).toHaveBeenCalledWith(null);
    expect(ctx.setConnectionPhase).toHaveBeenCalledWith("menu");
    expect(ctx.flashError).toHaveBeenCalledWith("Fuiste expulsado del grupo");
    expect(ctx.stopReconnecting).toHaveBeenCalledTimes(1);
    expect(ctx.notifyLeftGroup).toHaveBeenCalledTimes(1);
    expect(ctx.endColdStart).toHaveBeenCalledTimes(1);
  });
});

describe("dispatchInboundMessage", () => {
  let ctx: InboundMessageContext;
  beforeEach(() => {
    ctx = makeCtx();
  });

  it("routes to exactly the matching handler and no other", () => {
    const msg = { type: "left_instance" as const };
    dispatchInboundMessage(msg, ctx);
    expect(ctx.setConnectionPhase).toHaveBeenCalledWith("group");
    expect(ctx.setGroupMe).not.toHaveBeenCalled();
  });

  it("does nothing for an unknown message type", () => {
    const msg = { type: "not_a_real_type" } as never;
    expect(() => dispatchInboundMessage(msg, ctx)).not.toThrow();
    expect(ctx.setRoom).not.toHaveBeenCalled();
  });
});
