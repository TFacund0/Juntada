import { describe, test, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMultiplayerEntryProps } from "../useMultiplayerEntryProps";
import type { AppOutletContext } from "../../../pages/AppOutletContext";

const outletContext = vi.fn<() => Partial<AppOutletContext>>();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useOutletContext: () => outletContext() };
});

function baseContext(overrides: Partial<AppOutletContext> = {}): Partial<AppOutletContext> {
  return {
    gameId: "impostor",
    mode: "multi",
    groupFlow: false,
    game: null,
    playerName: "Ana",
    savePlayerName: vi.fn(),
    pendingGroupJoinCode: null,
    validJoinLink: null,
    groupIntent: undefined,
    handleRoomGameType: vi.fn(),
    setRoomPhase: vi.fn(),
    setRoomCode: vi.fn(),
    setGroupCode: vi.fn(),
    goHome: vi.fn(),
    goBack: vi.fn(),
    switchToGroupJoin: vi.fn(),
    setGroupAttached: vi.fn(),
    exposeReturnToGroup: vi.fn(),
    withAsyncCurtain: vi.fn(),
    settleAsyncCurtain: vi.fn(),
    curtain: "none",
    ...overrides,
  };
}

describe("useMultiplayerEntryProps", () => {
  test("returns guard inputs and maps every context field to its prop", () => {
    const ctx = baseContext();
    outletContext.mockReturnValue(ctx);

    const { result } = renderHook(() => useMultiplayerEntryProps());

    expect(result.current.mode).toBe("multi");
    expect(result.current.gameId).toBe("impostor");
    expect(result.current.groupFlow).toBe(false);

    const { props } = result.current;
    expect(props.gameId).toBe(ctx.gameId);
    expect(props.playerName).toBe(ctx.playerName);
    expect(props.onChangeName).toBe(ctx.savePlayerName);
    expect(props.initialGroupIntent).toBe(ctx.groupIntent);
    expect(props.onGameTypeChange).toBe(ctx.handleRoomGameType);
    expect(props.onRoomPhaseChange).toBe(ctx.setRoomPhase);
    expect(props.onRoomCodeChange).toBe(ctx.setRoomCode);
    expect(props.onGroupCodeChange).toBe(ctx.setGroupCode);
    expect(props.onLeaveGroup).toBe(ctx.goHome);
    expect(props.onExitRoomEntry).toBe(ctx.goBack);
    expect(props.onGoHome).toBe(ctx.goHome);
    expect(props.onSwitchToGroup).toBe(ctx.switchToGroupJoin);
    expect(props.onGroupAttachedChange).toBe(ctx.setGroupAttached);
    expect(props.onExposeReturnToGroup).toBe(ctx.exposeReturnToGroup);
    expect(props.onTransitionSettled).toBe(ctx.settleAsyncCurtain);
    expect(props.curtain).toBe("none");
  });

  test("initialJoinCode falls back to validJoinLink.code when pendingGroupJoinCode is null", () => {
    outletContext.mockReturnValue(
      baseContext({ pendingGroupJoinCode: null, validJoinLink: { code: "ABC123" } as AppOutletContext["validJoinLink"] }),
    );

    const { result } = renderHook(() => useMultiplayerEntryProps());

    expect(result.current.props.initialJoinCode).toBe("ABC123");
  });

  test("initialJoinCode prefers pendingGroupJoinCode over validJoinLink", () => {
    outletContext.mockReturnValue(
      baseContext({ pendingGroupJoinCode: "PEND1", validJoinLink: { code: "ABC123" } as AppOutletContext["validJoinLink"] }),
    );

    const { result } = renderHook(() => useMultiplayerEntryProps());

    expect(result.current.props.initialJoinCode).toBe("PEND1");
  });

  test("runTransition passes themedOverride when provided", () => {
    const withAsyncCurtain = vi.fn();
    outletContext.mockReturnValue(baseContext({ withAsyncCurtain, game: { gameTheme: "dark" } as AppOutletContext["game"] }));

    const { result } = renderHook(() => useMultiplayerEntryProps());
    const action = vi.fn();
    result.current.props.runTransition?.(action, false);

    expect(withAsyncCurtain).toHaveBeenCalledWith(action, false);
  });

  test("runTransition falls back to Boolean(game?.gameTheme) when themedOverride is omitted", () => {
    const withAsyncCurtain = vi.fn();
    outletContext.mockReturnValue(baseContext({ withAsyncCurtain, game: { gameTheme: "dark" } as AppOutletContext["game"] }));

    const { result } = renderHook(() => useMultiplayerEntryProps());
    const action = vi.fn();
    result.current.props.runTransition?.(action);

    expect(withAsyncCurtain).toHaveBeenCalledWith(action, true);
  });

  test("runTransition falls back to false when there is no game", () => {
    const withAsyncCurtain = vi.fn();
    outletContext.mockReturnValue(baseContext({ withAsyncCurtain, game: null }));

    const { result } = renderHook(() => useMultiplayerEntryProps());
    const action = vi.fn();
    result.current.props.runTransition?.(action);

    expect(withAsyncCurtain).toHaveBeenCalledWith(action, false);
  });
});
