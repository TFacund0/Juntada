import { useMemo } from "react";
import type { GameDef } from "../../games/gameTypes";
import type { JoinLink } from "../../features/multiplayer/utils/joinLink";
import type { GameSessionContextValue } from "../../pages/context/GameSessionContext";
import type { GameBridgeContextValue } from "../../pages/context/GameBridgeContext";
import type { CurtainContextValue } from "../../pages/context/CurtainContext";
import type { PlayerSessionContextValue } from "../../pages/context/PlayerSessionContext";
import type { AppShellContextValue } from "../../pages/context/AppShellContext";
import type { useAppSession } from "../session/useAppSession";
import type { useGameBridgeRefs } from "./useGameBridgeRefs";
import type { useStepTransition } from "./useStepTransition";
import type { useAppShell } from "./useAppShell";

type AppSession = ReturnType<typeof useAppSession>;
type BridgeRefs = ReturnType<typeof useGameBridgeRefs>;
type StepTransition = ReturnType<typeof useStepTransition>;
type Shell = ReturnType<typeof useAppShell>;

interface AppLevelExtras {
  playerName: string;
  savePlayerName: (name: string) => void;
  validJoinLink: JoinLink | null;
  goBack: () => void;
}

export interface AppContextValues {
  gameSession: GameSessionContextValue;
  gameBridge: GameBridgeContextValue;
  curtain: CurtainContextValue;
  playerSession: PlayerSessionContextValue;
  appShell: AppShellContextValue;
}

/**
 * Composition root for the 5 values provided around <Outlet> in
 * AppMainContent.tsx (see pages/context/ for each Provider) — successor to
 * the single AppOutletContext object, split by domain so a page only
 * re-renders for the slice it actually reads. Takes the same
 * already-instantiated leaf-hook results useAppOrchestration always did.
 *
 * Each slice gets its own useMemo instead of one combined one: a change to
 * curtain no longer invalidates the reference pages that only read
 * gameSession hold onto.
 */
export function useAppContextValues(
  session: AppSession,
  bridgeRefs: BridgeRefs,
  stepTransition: StepTransition,
  shell: Shell,
  { playerName, savePlayerName, validJoinLink, goBack }: AppLevelExtras,
): AppContextValues {
  const {
    gameId,
    setGameId,
    mode,
    setMode,
    game,
    groupFlow,
    groupIntent,
    pendingGroupJoinCode,
    switchToGroupJoin,
    setRoomCode,
    setGroupCode,
    groupAttached,
    setGroupAttached,
    setRoomPhase,
    handleRoomGameType,
    GAME_LIST,
  } = session;
  const { exposeReturnToGroup, exposeLocalGameBack, exposeLocalGameReset } = bridgeRefs;
  const { curtain: curtainState, withCurtain, withAsyncCurtain, settleAsyncCurtain } = stepTransition;
  const { pickGame, goHome } = shell;

  const gameSession = useMemo<GameSessionContextValue>(
    () => ({
      gameId,
      setGameId,
      mode,
      setMode,
      game,
      groupFlow,
      groupIntent,
      pendingGroupJoinCode,
      switchToGroupJoin,
      setRoomCode,
      setGroupCode,
      groupAttached,
      setGroupAttached,
      setRoomPhase,
      handleRoomGameType,
      GAME_LIST: GAME_LIST as GameDef[],
    }),
    [
      gameId,
      setGameId,
      mode,
      setMode,
      game,
      groupFlow,
      groupIntent,
      pendingGroupJoinCode,
      switchToGroupJoin,
      setRoomCode,
      setGroupCode,
      groupAttached,
      setGroupAttached,
      setRoomPhase,
      handleRoomGameType,
      GAME_LIST,
    ],
  );

  const gameBridge = useMemo<GameBridgeContextValue>(
    () => ({ exposeReturnToGroup, exposeLocalGameBack, exposeLocalGameReset }),
    [exposeReturnToGroup, exposeLocalGameBack, exposeLocalGameReset],
  );

  const curtain = useMemo<CurtainContextValue>(
    () => ({
      curtain: curtainState,
      withCurtain: (action: () => void, themed?: boolean) => withCurtain(action, Boolean(themed)),
      // See CurtainContextValue's own comment on why this cast is needed —
      // relocated verbatim from the old useAppOutletContext.ts.
      withAsyncCurtain: withAsyncCurtain as CurtainContextValue["withAsyncCurtain"],
      settleAsyncCurtain,
    }),
    [curtainState, withCurtain, withAsyncCurtain, settleAsyncCurtain],
  );

  const playerSession = useMemo<PlayerSessionContextValue>(
    () => ({ playerName, savePlayerName, validJoinLink }),
    [playerName, savePlayerName, validJoinLink],
  );

  const appShell = useMemo<AppShellContextValue>(() => ({ pickGame, goHome, goBack }), [pickGame, goHome, goBack]);

  return { gameSession, gameBridge, curtain, playerSession, appShell };
}
