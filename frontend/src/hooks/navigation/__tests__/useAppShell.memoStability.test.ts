import { describe, test, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAppShell } from "../useAppShell";
import { useAppOutletContext } from "../useAppOutletContext";

// Regression test for the design's "Fixed Memoization in useAppShell and
// useAppOutletContext" requirement: confirmGoBack/goHome/pickGame/
// startGroupFlow (useAppShell) and the outlet context object
// (useAppOutletContext) must now be referentially stable (===) across a
// re-render with unchanged inputs — see T2/T3/T9 in tasks.

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

    const { result, rerender } = renderHook(props => useAppShell(props.session, props.dialogs, props.headerUI, props.withCurtain), {
      initialProps: { session, dialogs, headerUI, withCurtain },
    });

    const first = result.current;
    rerender({ session, dialogs, headerUI, withCurtain });
    const second = result.current;

    expect(second.confirmGoBack).toBe(first.confirmGoBack);
    expect(second.goHome).toBe(first.goHome);
    expect(second.pickGame).toBe(first.pickGame);
    expect(second.startGroupFlow).toBe(first.startGroupFlow);
  });
});

describe("useAppOutletContext memo stability", () => {
  test("returns a referentially identical object across a re-render with unchanged inputs", () => {
    const session = stableSession();
    const bridgeRefs = {
      returnToGroupRef: { current: () => {} },
      localGameMidMatchRef: { current: () => false },
      localGameResetRef: { current: () => {} },
      exposeReturnToGroup: vi.fn(),
      exposeLocalGameBack: vi.fn(),
      exposeLocalGameReset: vi.fn(),
    } as unknown as Parameters<typeof useAppOutletContext>[1];
    const stepTransition = {
      curtain: "none",
      withCurtain: vi.fn(),
      withAsyncCurtain: vi.fn(),
      settleAsyncCurtain: vi.fn(),
      stepKey: "picker",
      stepDirection: "forward",
    } as unknown as Parameters<typeof useAppOutletContext>[2];
    const shell = {
      confirmGoBack: vi.fn(),
      goHome: vi.fn(),
      pickGame: vi.fn(),
      startGroupFlow: vi.fn(),
    } as unknown as Parameters<typeof useAppOutletContext>[3];
    const extras = {
      playerName: "Ana",
      savePlayerName: vi.fn(),
      validJoinLink: null,
      goBack: vi.fn(),
    };

    const { result, rerender } = renderHook(
      props => useAppOutletContext(props.session, props.bridgeRefs, props.stepTransition, props.shell, props.extras),
      { initialProps: { session, bridgeRefs, stepTransition, shell, extras } },
    );

    const first = result.current;
    rerender({ session, bridgeRefs, stepTransition, shell, extras });
    const second = result.current;

    expect(second).toBe(first);
  });
});
