import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { S } from "./theme/styles";
import "./theme/curtain.css";
import "./theme/sharedChrome.css";
import "./theme/homeDesign.css";
import { isGameAvailable } from "./games/maintenance";
import { GameRules } from "./components/shell/GameRules";
import { AppConfirmDialogs } from "./components/shell/AppConfirmDialogs";
import { AppBackdrop } from "./components/shell/AppBackdrop";
import { DevNoticeDialog } from "./components/shell/DevNoticeDialog";
import { NameOnboardingScreen } from "./components/shell/NameOnboardingScreen";
import { ScreenFade } from "./components/ui/ScreenFade";
import { AppHeader } from "./components/shell/AppHeader";
import { AppShellLayout } from "./components/shell/AppShellLayout";
import { getGame } from "./games/registry";
import { loadActive } from "./hooks/useActiveSession";
import { useValidJoinLink } from "./features/multiplayer/hooks/useValidJoinLink";
import { useGameTheme } from "./hooks/useGameTheme";
import { useAppSession } from "./hooks/useAppSession";
import { useGameBridgeRefs } from "./hooks/useGameBridgeRefs";
import { useAppDialogs } from "./hooks/useAppDialogs";
import { useHeaderUI } from "./hooks/useHeaderUI";
import { useBackNavigation } from "./hooks/useBackNavigation";
import { useStepTransition } from "./hooks/useStepTransition";
import { useAppShell } from "./hooks/useAppShell";
import { useAppOutletContext } from "./hooks/useAppOutletContext";
import { useDevNotice } from "./hooks/useDevNotice";
import { usePlayerName } from "./hooks/usePlayerName";
import { setAppInGame } from "./utils/appActivity";

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP — pathless PARENT/layout route. Owns the 6 slice-(b) leaf hooks +
// chrome (AppHeader, AppBackdrop, ScreenFade, AppConfirmDialogs, dev notice,
// theme sync) exactly once, and hands their combined state down to whichever
// leaf page is currently matched (frontend/src/pages/) via
// <Outlet context={...}/> — see AppOutletContext.ts for the exact shape and
// design.md for why App must stay a single non-remounting parent route
// (remounting on every path change would destroy this state).
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
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
  const { playerName, savePlayerName } = usePlayerName();

  // Whether a themed game's reskin is actually on screen right now — used
  // to drive the body/theme-color sync effect. Computed above the
  // "!playerName" early return further down since Hooks (the effect right
  // after it) can never be called conditionally.
  const { activeTheme, accentColor, mutedColor } = useGameTheme(game, inGameView);

  // Lets a pending service worker update (see useServiceWorkerUpdate) know
  // it's not safe to reload right now — a round can last just a few
  // seconds, and yanking the page mid-tap would lose whatever the player
  // was doing. useEffect (not a direct call in the render body) so this
  // only fires on an actual mode change, not every re-render.
  useEffect(() => {
    setAppInGame(inGameView);
  }, [inGameView]);

  // Combined state/callbacks handed down to whichever leaf page is
  // currently matched — see AppOutletContext.ts for the exact shape each
  // page under frontend/src/pages/ expects.
  const outletContext = useAppOutletContext(session, bridgeRefs, stepTransition, shell, {
    playerName,
    savePlayerName,
    validJoinLink,
    goBack,
  });

  if (!playerName) return <NameOnboardingScreen onSave={savePlayerName} />;

  return (
    <div
      style={{
        ...S.app,
        ...activeTheme?.app,
        position: "relative",
        transition: "background-color .4s ease, color .4s ease",
      }}
    >
      <AppBackdrop curtain={curtain} activeTheme={activeTheme} accentColor={accentColor} />
      {(() => {
        const header = (
          <AppHeader
            gameId={gameId}
            mode={mode}
            groupFlow={groupFlow}
            groupAttached={groupAttached}
            game={game}
            accentColor={accentColor}
            mutedColor={mutedColor}
            playerName={playerName}
            onSavePlayerName={savePlayerName}
            onBack={goBack}
            onExit={() => setShowExitConfirm(true)}
            showProfileMenu={showProfileMenu}
            onToggleProfileMenu={() => setShowProfileMenu(v => !v)}
            profileMenuRef={profileMenuRef}
            onStartGroupFlow={startGroupFlow}
            showRules={showRules}
            onToggleRules={() => setShowRules(v => !v)}
          />
        );
        const rest = (
          <>
            {showRules && (game?.rules?.length ?? 0) > 0 && <GameRules rules={game!.rules} onClose={() => setShowRules(false)} />}

            <ScreenFade transitionKey={stepKey} direction={stepDirection} skipAnimation={curtain !== "none"}>
              <Outlet context={outletContext} />
            </ScreenFade>
          </>
        );

        return <AppShellLayout stepKey={stepKey} game={game} inGameView={inGameView} header={header} rest={rest} />;
      })()}

      {showDevNotice && <DevNoticeDialog onClose={dismissDevNotice} />}

      <AppConfirmDialogs
        showBackConfirm={showBackConfirm}
        onConfirmGoBack={confirmGoBack}
        onCancelBackConfirm={() => setShowBackConfirm(false)}
        showLocalResetConfirm={showLocalResetConfirm}
        onConfirmLocalReset={() => {
          setShowLocalResetConfirm(false);
          localGameResetRef.current?.();
        }}
        onCancelLocalResetConfirm={() => setShowLocalResetConfirm(false)}
        showExitConfirm={showExitConfirm}
        groupAttached={groupAttached}
        onConfirmExit={goHome}
        onCancelExitConfirm={() => setShowExitConfirm(false)}
        showReturnToGroupConfirm={showReturnToGroupConfirm}
        onConfirmReturnToGroup={() => {
          setShowReturnToGroupConfirm(false);
          returnToGroupRef.current?.();
        }}
        onCancelReturnToGroupConfirm={() => setShowReturnToGroupConfirm(false)}
      />
    </div>
  );
}
