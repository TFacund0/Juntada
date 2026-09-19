import { describe, test, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMultiplayerEntryProps } from "../useMultiplayerEntryProps";
import type { GameSessionContextValue } from "../../../pages/context/GameSessionContext";
import type { GameBridgeContextValue } from "../../../pages/context/GameBridgeContext";
import type { CurtainContextValue } from "../../../pages/context/CurtainContext";
import type { PlayerSessionContextValue } from "../../../pages/context/PlayerSessionContext";
import type { AppShellContextValue } from "../../../pages/context/AppShellContext";

const gameSession = vi.fn<() => Partial<GameSessionContextValue>>();
const gameBridge = vi.fn<() => Partial<GameBridgeContextValue>>();
const curtainCtx = vi.fn<() => Partial<CurtainContextValue>>();
const playerSession = vi.fn<() => Partial<PlayerSessionContextValue>>();
const appShell = vi.fn<() => Partial<AppShellContextValue>>();

vi.mock("../../../pages/context/GameSessionContext", () => ({ useGameSessionContext: () => gameSession() }));
vi.mock("../../../pages/context/GameBridgeContext", () => ({ useGameBridgeContext: () => gameBridge() }));
vi.mock("../../../pages/context/CurtainContext", () => ({ useCurtainContext: () => curtainCtx() }));
vi.mock("../../../pages/context/PlayerSessionContext", () => ({ usePlayerSessionContext: () => playerSession() }));
vi.mock("../../../pages/context/AppShellContext", () => ({ useAppShellContext: () => appShell() }));

function baseGameSession(overrides: Partial<GameSessionContextValue> = {}): Partial<GameSessionContextValue> {
  return {
    gameId: "impostor",
    mode: "multi",
    groupFlow: false,
    game: null,
    pendingGroupJoinCode: null,
    groupIntent: undefined,
    handleRoomGameType: vi.fn(),
    setRoomPhase: vi.fn(),
    setRoomCode: vi.fn(),
    setGroupCode: vi.fn(),
    switchToGroupJoin: vi.fn(),
    setGroupAttached: vi.fn(),
    setRoomRoster: vi.fn(),
    ...overrides,
  };
}

function setupContexts(overrides: {
  gameSession?: Partial<GameSessionContextValue>;
  gameBridge?: Partial<GameBridgeContextValue>;
  curtain?: Partial<CurtainContextValue>;
  playerSession?: Partial<PlayerSessionContextValue>;
  appShell?: Partial<AppShellContextValue>;
}) {
  gameSession.mockReturnValue(baseGameSession(overrides.gameSession));
  gameBridge.mockReturnValue({
    exposeReturnToGroup: vi.fn(),
    exposeLeaveRoom: vi.fn(),
    exposeRoomAction: vi.fn(),
    ...overrides.gameBridge,
  });
  curtainCtx.mockReturnValue({ withAsyncCurtain: vi.fn(), settleAsyncCurtain: vi.fn(), curtain: "none", ...overrides.curtain });
  playerSession.mockReturnValue({ playerName: "Ana", savePlayerName: vi.fn(), validJoinLink: null, ...overrides.playerSession });
  appShell.mockReturnValue({ goHome: vi.fn(), goBack: vi.fn(), ...overrides.appShell });
}

describe("useMultiplayerEntryProps", () => {
  test("returns guard inputs and maps every context field to its prop", () => {
    setupContexts({});
    const gs = gameSession();
    const gb = gameBridge();
    const ct = curtainCtx();
    const ps = playerSession();
    const as = appShell();
    // Re-arm mocks after the calls above, since the hook under test invokes
    // each of these itself and vi.fn() mockReturnValue is stable across calls.

    const { result } = renderHook(() => useMultiplayerEntryProps());

    expect(result.current.mode).toBe("multi");
    expect(result.current.gameId).toBe("impostor");
    expect(result.current.groupFlow).toBe(false);

    const { props } = result.current;
    expect(props.gameId).toBe(gs.gameId);
    expect(props.playerName).toBe(ps.playerName);
    expect(props.onChangeName).toBe(ps.savePlayerName);
    expect(props.initialGroupIntent).toBe(gs.groupIntent);
    expect(props.onGameTypeChange).toBe(gs.handleRoomGameType);
    expect(props.onRoomPhaseChange).toBe(gs.setRoomPhase);
    expect(props.onRoomCodeChange).toBe(gs.setRoomCode);
    expect(props.onGroupCodeChange).toBe(gs.setGroupCode);
    expect(props.onLeaveGroup).toBe(as.goHome);
    expect(props.onExitRoomEntry).toBe(as.goBack);
    expect(props.onGoHome).toBe(as.goHome);
    expect(props.onSwitchToGroup).toBe(gs.switchToGroupJoin);
    expect(props.onGroupAttachedChange).toBe(gs.setGroupAttached);
    expect(props.onExposeReturnToGroup).toBe(gb.exposeReturnToGroup);
    expect(props.onExposeLeaveRoom).toBe(gb.exposeLeaveRoom);
    expect(props.onExposeRoomAction).toBe(gb.exposeRoomAction);
    expect(props.onRoomRosterChange).toBe(gs.setRoomRoster);
    expect(props.onTransitionSettled).toBe(ct.settleAsyncCurtain);
    expect(props.curtain).toBe("none");
  });

  test("initialJoinCode falls back to validJoinLink.code when pendingGroupJoinCode is null", () => {
    setupContexts({
      gameSession: { pendingGroupJoinCode: null },
      playerSession: { validJoinLink: { code: "ABC123" } as PlayerSessionContextValue["validJoinLink"] },
    });

    const { result } = renderHook(() => useMultiplayerEntryProps());

    expect(result.current.props.initialJoinCode).toBe("ABC123");
  });

  test("initialJoinCode prefers pendingGroupJoinCode over validJoinLink", () => {
    setupContexts({
      gameSession: { pendingGroupJoinCode: "PEND1" },
      playerSession: { validJoinLink: { code: "ABC123" } as PlayerSessionContextValue["validJoinLink"] },
    });

    const { result } = renderHook(() => useMultiplayerEntryProps());

    expect(result.current.props.initialJoinCode).toBe("PEND1");
  });

  test("runTransition passes themedOverride when provided", () => {
    const withAsyncCurtain = vi.fn();
    setupContexts({
      curtain: { withAsyncCurtain },
      gameSession: { game: { gameTheme: "dark" } as GameSessionContextValue["game"] },
    });

    const { result } = renderHook(() => useMultiplayerEntryProps());
    const action = vi.fn();
    result.current.props.runTransition?.(action, false);

    expect(withAsyncCurtain).toHaveBeenCalledWith(action, false);
  });

  test("runTransition falls back to Boolean(game?.gameTheme) when themedOverride is omitted", () => {
    const withAsyncCurtain = vi.fn();
    setupContexts({
      curtain: { withAsyncCurtain },
      gameSession: { game: { gameTheme: "dark" } as GameSessionContextValue["game"] },
    });

    const { result } = renderHook(() => useMultiplayerEntryProps());
    const action = vi.fn();
    result.current.props.runTransition?.(action);

    expect(withAsyncCurtain).toHaveBeenCalledWith(action, true);
  });

  test("runTransition falls back to false when there is no game", () => {
    const withAsyncCurtain = vi.fn();
    setupContexts({ curtain: { withAsyncCurtain }, gameSession: { game: null } });

    const { result } = renderHook(() => useMultiplayerEntryProps());
    const action = vi.fn();
    result.current.props.runTransition?.(action);

    expect(withAsyncCurtain).toHaveBeenCalledWith(action, false);
  });
});
