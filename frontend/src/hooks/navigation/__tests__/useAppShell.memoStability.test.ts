import { describe, test, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAppShell } from "../useAppShell";

// Regression test for the design's "Fixed Memoization in useAppShell"
// requirement: confirmGoBack/goHome/pickGame/startGroupFlow must be
// referentially stable (===) across a re-render with unchanged inputs — see
// T2/T3/T9 in tasks. The old useAppOutletContext half of this test was
// removed along with that hook — see useAppContextValues.ts and its own
// __tests__ for the successor per-slice memoization coverage.

function stableSession() {
  return {
    gameId: null,
    setGameId: vi.fn(),
    mode: null,
    setMode: vi.fn(),
    game: null,
    groupFlow: false,
    setGroupFlow: vi.fn(),
    roomCode: null,
    setRoomCode: vi.fn(),
    groupCode: null,
    setGroupCode: vi.fn(),
    groupIntent: undefined,
    setGroupIntent: vi.fn(),
    pendingGroupJoinCode: null,
    setPendingGroupJoinCode: vi.fn(),
    switchToGroupJoin: vi.fn(),
    groupAttached: false,
    setGroupAttached: vi.fn(),
    inRoom: false,
    inGameView: false,
    roomPhase: null,
    setRoomPhase: vi.fn(),
    handleRoomGameType: vi.fn(),
    GAME_LIST: [],
  } as unknown as Parameters<typeof useAppShell>[0];
}

function stableDialogs() {
  return {
    showExitConfirm: false,
    setShowExitConfirm: vi.fn(),
    showBackConfirm: false,
    setShowBackConfirm: vi.fn(),
    showLocalResetConfirm: false,
    setShowLocalResetConfirm: vi.fn(),
    showReturnToGroupConfirm: false,
    setShowReturnToGroupConfirm: vi.fn(),
  } as unknown as Parameters<typeof useAppShell>[1];
}

function stableHeaderUI() {
  return {
    showProfileMenu: false,
    setShowProfileMenu: vi.fn(),
    profileMenuRef: { current: null },
    showRules: false,
    setShowRules: vi.fn(),
  } as unknown as Parameters<typeof useAppShell>[2];
}

describe("useAppShell memo stability", () => {
  test("confirmGoBack/goHome/pickGame/startGroupFlow stay referentially identical across a re-render with unchanged deps", () => {
    const session = stableSession();
    const dialogs = stableDialogs();
    const headerUI = stableHeaderUI();
    const withCurtain = vi.fn();
    const leaveRoomRef = { current: vi.fn() };

    const { result, rerender } = renderHook(
      props => useAppShell(props.session, props.dialogs, props.headerUI, props.withCurtain, props.leaveRoomRef),
      {
        initialProps: { session, dialogs, headerUI, withCurtain, leaveRoomRef },
      },
    );

    const first = result.current;
    rerender({ session, dialogs, headerUI, withCurtain, leaveRoomRef });
    const second = result.current;

    expect(second.confirmGoBack).toBe(first.confirmGoBack);
    expect(second.goHome).toBe(first.goHome);
    expect(second.pickGame).toBe(first.pickGame);
    expect(second.startGroupFlow).toBe(first.startGroupFlow);
  });
});
