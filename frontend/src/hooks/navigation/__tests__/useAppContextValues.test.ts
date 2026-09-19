import { describe, test, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAppContextValues } from "../useAppContextValues";
import type { useAppSession } from "../../session/useAppSession";
import type { useGameBridgeRefs } from "../useGameBridgeRefs";
import type { useStepTransition } from "../useStepTransition";
import type { useAppShell } from "../useAppShell";

type AppSession = ReturnType<typeof useAppSession>;
type BridgeRefs = ReturnType<typeof useGameBridgeRefs>;
type StepTransition = ReturnType<typeof useStepTransition>;
type Shell = ReturnType<typeof useAppShell>;

// Stable stand-ins (unlike the old useAppOutletContext test, which stubbed
// pickGame/goHome as unstable on purpose — that was reproducing a bug that
// no longer exists, see useAppShell.ts's own useCallback wrapping).
function makeSession(): AppSession {
  return {
    gameId: null,
    setGameId: vi.fn(),
    mode: null,
    setMode: vi.fn(),
    game: null,
    groupFlow: false,
    groupIntent: undefined,
    pendingGroupJoinCode: null,
    switchToGroupJoin: vi.fn(),
    setRoomCode: vi.fn(),
    setGroupCode: vi.fn(),
    groupAttached: false,
    setGroupAttached: vi.fn(),
    setRoomPhase: vi.fn(),
    setRoomRoster: vi.fn(),
    handleRoomGameType: vi.fn(),
    GAME_LIST: [],
  } as unknown as AppSession;
}

function makeBridgeRefs(): BridgeRefs {
  return {
    exposeReturnToGroup: vi.fn(),
    exposeLeaveRoom: vi.fn(),
    exposeRoomAction: vi.fn(),
    exposeLocalGameBack: vi.fn(),
    exposeLocalGameReset: vi.fn(),
  } as unknown as BridgeRefs;
}

function makeStepTransition(): StepTransition {
  return {
    curtain: "none",
    withCurtain: vi.fn(),
    withAsyncCurtain: vi.fn(),
    settleAsyncCurtain: vi.fn(),
    stepKey: "picker",
    stepDirection: "forward",
  } as unknown as StepTransition;
}

function makeShell(): Shell {
  return {
    confirmGoBack: vi.fn(),
    goHome: vi.fn(),
    pickGame: vi.fn(),
    startGroupFlow: vi.fn(),
  } as unknown as Shell;
}

function makeExtras() {
  return { playerName: "Ada", savePlayerName: vi.fn(), validJoinLink: null, goBack: vi.fn() };
}

describe("useAppContextValues shape", () => {
  test("returns the 5 domain slices with their expected fields", () => {
    const { result } = renderHook(() =>
      useAppContextValues(makeSession(), makeBridgeRefs(), makeStepTransition(), makeShell(), makeExtras()),
    );

    expect(result.current.gameSession).toMatchObject({ gameId: null, mode: null, game: null, groupFlow: false, GAME_LIST: [] });
    expect(result.current.gameBridge).toMatchObject({});
    expect(typeof result.current.gameBridge.exposeReturnToGroup).toBe("function");
    expect(typeof result.current.gameBridge.exposeLeaveRoom).toBe("function");
    expect(result.current.curtain).toMatchObject({ curtain: "none" });
    expect(typeof result.current.curtain.withCurtain).toBe("function");
    expect(result.current.playerSession).toMatchObject({ playerName: "Ada", validJoinLink: null });
    expect(typeof result.current.appShell.pickGame).toBe("function");
    expect(typeof result.current.appShell.goHome).toBe("function");
    expect(typeof result.current.appShell.goBack).toBe("function");
  });
});

describe("useAppContextValues memo stability", () => {
  test("each of the 5 slices stays referentially identical across a re-render with unchanged inputs", () => {
    const session = makeSession();
    const bridgeRefs = makeBridgeRefs();
    const stepTransition = makeStepTransition();
    const shell = makeShell();
    const extras = makeExtras();

    const { result, rerender } = renderHook(() => useAppContextValues(session, bridgeRefs, stepTransition, shell, extras));

    const first = result.current;
    rerender();
    const second = result.current;

    expect(second.gameSession).toBe(first.gameSession);
    expect(second.gameBridge).toBe(first.gameBridge);
    expect(second.curtain).toBe(first.curtain);
    expect(second.playerSession).toBe(first.playerSession);
    expect(second.appShell).toBe(first.appShell);
  });

  test("changing only curtain state invalidates just the curtain slice, not the others", () => {
    const session = makeSession();
    const bridgeRefs = makeBridgeRefs();
    const shell = makeShell();
    const extras = makeExtras();

    const { result, rerender } = renderHook(
      ({ stepTransition }) => useAppContextValues(session, bridgeRefs, stepTransition, shell, extras),
      { initialProps: { stepTransition: makeStepTransition() } },
    );

    const first = result.current;
    rerender({ stepTransition: { ...makeStepTransition(), curtain: "out" } as unknown as StepTransition });
    const second = result.current;

    expect(second.curtain).not.toBe(first.curtain);
    expect(second.gameSession).toBe(first.gameSession);
    expect(second.gameBridge).toBe(first.gameBridge);
    expect(second.playerSession).toBe(first.playerSession);
    expect(second.appShell).toBe(first.appShell);
  });
});
