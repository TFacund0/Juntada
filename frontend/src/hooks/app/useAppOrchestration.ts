import { useEffect } from "react";
import { isGameAvailable } from "../../games/maintenance";
import { getGame } from "../../games/registry";
import { loadActive } from "../session/useActiveSession";
import { useValidJoinLink } from "../../features/multiplayer/hooks/useValidJoinLink";
import { useGameTheme } from "../ui/useGameTheme";
import { useAppSession } from "../session/useAppSession";
import { useGameBridgeRefs } from "../navigation/useGameBridgeRefs";
import { useAppDialogs } from "../navigation/useAppDialogs";
import { useHeaderUI } from "../ui/useHeaderUI";
import { useBackNavigation } from "../navigation/useBackNavigation";
import { useStepTransition } from "../navigation/useStepTransition";
import { useAppShell } from "../navigation/useAppShell";
import { useAppContextValues } from "../navigation/useAppContextValues";
import { useDevNotice } from "../ui/useDevNotice";
import { useAuth } from "../../features/auth/context/AuthContext";
import { setAppInGame } from "../../utils/appActivity";

/**
 * Composition root for everything App.tsx used to wire directly — calls the
 * same 12 leaf hooks in the exact order App.tsx called them, and returns
 * only the flat set of fields App.tsx (and its delegated components) still
 * consume. See design.md for why this order and this exact return shape
 * (no widened surface, no per-hook namespacing).
 */
export function useAppOrchestration() {
  const validJoinLink = useValidJoinLink();
  const restoredRaw = validJoinLink ? null : loadActive();
  // A session persisted before a deploy that removed/renamed the game, or
  // put it into maintenance, would otherwise restore straight into a
  // ModePicker/local match for a game that's no longer selectable from the
  // home screen at all — go home instead in that case.
  const restoredGame = restoredRaw ? getGame(restoredRaw.gameId) : undefined;
  const restored = restoredRaw && restoredGame && isGameAvailable(restoredGame) ? restoredRaw : null;

  const session = useAppSession(validJoinLink, restored);
  const bridgeRefs = useGameBridgeRefs();
  const dialogs = useAppDialogs();
  const headerUI = useHeaderUI();

  const { goBack } = useBackNavigation({
    gameId: session.gameId,
    mode: session.mode,
    groupFlow: session.groupFlow,
    roomCode: session.roomCode,
    groupCode: session.groupCode,
    groupAttached: session.groupAttached,
    roomPhase: session.roomPhase,
    inRoom: session.inRoom,
    returnToGroupRef: bridgeRefs.returnToGroupRef,
    localGameMidMatchRef: bridgeRefs.localGameMidMatchRef,
    setMode: session.setMode,
    setRoomCode: session.setRoomCode,
    setGameId: session.setGameId,
    setShowRules: headerUI.setShowRules,
    setShowExitConfirm: dialogs.setShowExitConfirm,
    setShowBackConfirm: dialogs.setShowBackConfirm,
    setShowLocalResetConfirm: dialogs.setShowLocalResetConfirm,
    setShowReturnToGroupConfirm: dialogs.setShowReturnToGroupConfirm,
  });

  const stepTransition = useStepTransition({
    gameId: session.gameId,
    groupFlow: session.groupFlow,
    game: session.game,
    mode: session.mode,
  });
  const { curtain, withCurtain, stepKey, stepDirection } = stepTransition;

  const shell = useAppShell(session, dialogs, headerUI, withCurtain);
  const { confirmGoBack, goHome, startGroupFlow } = shell;

  const { gameId, mode, game, groupFlow, groupAttached, inGameView } = session;
  const { localGameResetRef, returnToGroupRef } = bridgeRefs;
  const {
    showExitConfirm,
    setShowExitConfirm,
    showBackConfirm,
    setShowBackConfirm,
    showLocalResetConfirm,
    setShowLocalResetConfirm,
    showReturnToGroupConfirm,
    setShowReturnToGroupConfirm,
  } = dialogs;
  const { showProfileMenu, setShowProfileMenu, profileMenuRef, showRules, setShowRules } = headerUI;

  const { showDevNotice, dismissDevNotice } = useDevNotice();
  // Identity now comes from the account (see features/auth/), not a
  // localStorage-only free-form name — playerName IS the account's
  // username, and savePlayerName renames it via PATCH /api/me. Kept as the
  // same `playerName`/`savePlayerName` prop contract that already threads
  // through AppHeader/HomeNavbar/MultiplayerGame so those components don't
  // need to change — the error surfacing needed for a taken-username rename
  // (see design's user-profile spec) lives in ProfilePanel instead, which
  // calls useAuth().updateProfile directly.
  const { user, updateProfile } = useAuth();
  const playerName = user?.username ?? "";
  const savePlayerName = (name: string) => {
    void updateProfile({ username: name });
  };

  // Whether a themed game's reskin is actually on screen right now — used
  // to drive the body/theme-color sync effect. Computed above any early
  // return the caller might perform, since Hooks (the effect right after
  // it) can never be called conditionally.
  const { activeTheme, accentColor, mutedColor } = useGameTheme(game, inGameView);

  // Lets a pending service worker update (see useServiceWorkerUpdate) know
  // it's not safe to reload right now — a round can last just a few
  // seconds, and yanking the page mid-tap would lose whatever the player
  // was doing. useEffect (not a direct call in the render body) so this
  // only fires on an actual mode change, not every re-render.
  useEffect(() => {
    setAppInGame(inGameView);
  }, [inGameView]);

  // The 5 domain-scoped values provided around <Outlet> in AppMainContent —
  // see pages/context/ for what each page under frontend/src/pages/ expects.
  const contextValues = useAppContextValues(session, bridgeRefs, stepTransition, shell, {
    playerName,
    savePlayerName,
    validJoinLink,
    goBack,
  });

  return {
    gameId,
    mode,
    game,
    groupFlow,
    groupAttached,
    inGameView,
    activeTheme,
    accentColor,
    mutedColor,
    curtain,
    stepKey,
    stepDirection,
    playerName,
    savePlayerName,
    goBack,
    confirmGoBack,
    goHome,
    startGroupFlow,
    showProfileMenu,
    setShowProfileMenu,
    profileMenuRef,
    showRules,
    setShowRules,
    showExitConfirm,
    setShowExitConfirm,
    showBackConfirm,
    setShowBackConfirm,
    showLocalResetConfirm,
    setShowLocalResetConfirm,
    showReturnToGroupConfirm,
    setShowReturnToGroupConfirm,
    showDevNotice,
    dismissDevNotice,
    localGameResetRef,
    returnToGroupRef,
    contextValues,
  };
}
