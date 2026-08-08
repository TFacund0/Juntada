import { useMemo } from "react";
import type { GameDef } from "../games/gameTypes";
import type { JoinLink } from "../features/multiplayer/utils/joinLink";
import type { AppOutletContext } from "../pages/AppOutletContext";
import type { useAppSession } from "./useAppSession";
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

/**
 * Composition root for the value handed down via `<Outlet context=.../>` —
 * extracted verbatim from App.tsx's inline useMemo (see AppOutletContext.ts
 * for the exact shape every page under frontend/src/pages/ expects). Takes
 * the already-instantiated leaf-hook results (useAppSession, useGameBridgeRefs,
 * useStepTransition, useAppShell) plus the small set of App-level-only values,
 * mirroring the argument-composition pattern used by useAppShell.ts.
 *
 * NOTE: the dependency array below is copied byte-for-byte from the original
 * App.tsx useMemo, including its pre-existing bug — useAppShell returns
 * confirmGoBack/goHome/pickGame/startGroupFlow as new arrow functions on
 * every render (never memoized), and 3 of those (pickGame, goHome, and
 * withCurtain/withAsyncCurtain/settleAsyncCurtain from useStepTransition
 * are similarly unmemoized) sit in this array — so this useMemo already
 * recalculates on every render regardless. Fixing that is explicitly out of
 * scope here; this hook must reproduce the existing behavior exactly, not a
 * "corrected" version of it.
 */
export function useAppOutletContext(
  session: AppSession,
  bridgeRefs: BridgeRefs,
  stepTransition: StepTransition,
  shell: Shell,
  { playerName, savePlayerName, validJoinLink, goBack }: AppLevelExtras,
): AppOutletContext {
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
  const { curtain, withCurtain, withAsyncCurtain, settleAsyncCurtain } = stepTransition;
  const { pickGame, goHome } = shell;

  return useMemo(
    () => ({
      gameId,
      setGameId: session.setGameId,
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
      exposeReturnToGroup,
      exposeLocalGameBack,
      exposeLocalGameReset,
      playerName,
      savePlayerName,
      validJoinLink,
      curtain,
      withCurtain: (action: () => void, themed?: boolean) => withCurtain(action, Boolean(themed)),
      // withAsyncCurtain's real implementation (useCurtainTransition) calls
      // `action()` with no arguments — RoomPage/GroupPage (PR1, already
      // committed) call it with a `(settle) => void` action from
      // MultiplayerGame's runTransition, exactly like this same call site did
      // verbatim in the original inline App.tsx before this restructure.
      // AppOutletContext's declared type matches those callers' broader
      // signature, so bridging the concrete hook value through needs this
      // cast — behavior is unchanged from the original.
      withAsyncCurtain: withAsyncCurtain as AppOutletContext["withAsyncCurtain"],
      settleAsyncCurtain,
      pickGame,
      goHome,
      goBack,
    }),
    [
      gameId,
      session.setGameId,
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
      exposeReturnToGroup,
      exposeLocalGameBack,
      exposeLocalGameReset,
      playerName,
      validJoinLink,
      curtain,
      withCurtain,
      withAsyncCurtain,
      settleAsyncCurtain,
      pickGame,
      goHome,
      goBack,
    ],
  );
}
