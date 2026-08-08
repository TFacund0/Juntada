import { describe, test, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAppOutletContext } from "./useAppOutletContext";
import type { useAppSession } from "./useAppSession";
import type { useGameBridgeRefs } from "./useGameBridgeRefs";
import type { useStepTransition } from "./useStepTransition";
import type { useAppShell } from "./useAppShell";

type AppSession = ReturnType<typeof useAppSession>;
type BridgeRefs = ReturnType<typeof useGameBridgeRefs>;
type StepTransition = ReturnType<typeof useStepTransition>;
type Shell = ReturnType<typeof useAppShell>;

// Minimal stand-ins — only the fields useAppOutletContext actually reads.
const makeSession = (): AppSession =>
  ({
    gameId: null,
    setGameId: () => {},
    mode: null,
    setMode: () => {},
    game: null,
    groupFlow: false,
    groupIntent: undefined,
    pendingGroupJoinCode: null,
    switchToGroupJoin: () => {},
    setRoomCode: () => {},
    setGroupCode: () => {},
    groupAttached: false,
    setGroupAttached: () => {},
    setRoomPhase: () => {},
    handleRoomGameType: () => {},
    GAME_LIST: [],
  }) as unknown as AppSession;

const makeBridgeRefs = (): BridgeRefs =>
  ({
    exposeReturnToGroup: () => {},
    exposeLocalGameBack: () => {},
    exposeLocalGameReset: () => {},
  }) as unknown as BridgeRefs;

const makeStepTransition = (): StepTransition =>
  ({
    curtain: "none",
    withCurtain: () => {},
    withAsyncCurtain: () => {},
    settleAsyncCurtain: () => {},
    stepKey: "picker",
    stepDirection: "forward",
  }) as unknown as StepTransition;

// New function identities every call — mirrors useAppShell's real (unmemoized)
// return value, which is exactly what keeps the original App.tsx useMemo
// inert (see the hook's doc comment). Not stubbed as stable refs on purpose.
const makeShell = (): Shell =>
  ({
    confirmGoBack: () => {},
    goHome: () => {},
    pickGame: () => {},
    startGroupFlow: () => {},
  }) as unknown as Shell;

const makeExtras = () => ({
  playerName: "Ada",
  savePlayerName: () => {},
  validJoinLink: null,
  goBack: () => {},
});

describe("useAppOutletContext shape", () => {
  test("returns an object matching the AppOutletContext members", () => {
    const { result } = renderHook(() =>
      useAppOutletContext(makeSession(), makeBridgeRefs(), makeStepTransition(), makeShell(), makeExtras()),
    );

    expect(result.current).toMatchObject({
      gameId: null,
      mode: null,
      game: null,
      groupFlow: false,
      groupIntent: undefined,
      pendingGroupJoinCode: null,
      groupAttached: false,
      GAME_LIST: [],
      playerName: "Ada",
      validJoinLink: null,
      curtain: "none",
    });
    expect(typeof result.current.setGameId).toBe("function");
    expect(typeof result.current.setMode).toBe("function");
    expect(typeof result.current.switchToGroupJoin).toBe("function");
    expect(typeof result.current.setRoomCode).toBe("function");
    expect(typeof result.current.setGroupCode).toBe("function");
    expect(typeof result.current.setGroupAttached).toBe("function");
    expect(typeof result.current.setRoomPhase).toBe("function");
    expect(typeof result.current.handleRoomGameType).toBe("function");
    expect(typeof result.current.exposeReturnToGroup).toBe("function");
    expect(typeof result.current.exposeLocalGameBack).toBe("function");
    expect(typeof result.current.exposeLocalGameReset).toBe("function");
    expect(typeof result.current.savePlayerName).toBe("function");
    expect(typeof result.current.withCurtain).toBe("function");
    expect(typeof result.current.withAsyncCurtain).toBe("function");
    expect(typeof result.current.settleAsyncCurtain).toBe("function");
    expect(typeof result.current.pickGame).toBe("function");
    expect(typeof result.current.goHome).toBe("function");
    expect(typeof result.current.goBack).toBe("function");
  });
});

describe("useAppOutletContext memoization (preserves the original inert behavior)", () => {
  test("returns a new object reference on every render, unchanged as-is — NOT fixed", () => {
    // Reproduces the App.tsx original bug verbatim: useAppShell's pickGame/
    // goHome (in the dep array) are new function identities every call, so
    // even with every other input held stable, the memo below recalculates
    // on every render. This test asserts that pre-existing behavior stays
    // exactly as-is — "fixing" it here is explicitly out of scope for PR1.
    const session = makeSession();
    const bridgeRefs = makeBridgeRefs();
    const stepTransition = makeStepTransition();
    const extras = makeExtras();

    const { result, rerender } = renderHook(() => useAppOutletContext(session, bridgeRefs, stepTransition, makeShell(), extras));

    const first = result.current;
    rerender();
    const second = result.current;

    expect(second).not.toBe(first);
  });
});
