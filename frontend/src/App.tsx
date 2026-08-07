import { useState, useEffect, useMemo } from "react";
import { Outlet } from "react-router-dom";
import { S } from "./theme/styles";
import "./theme/curtain.css";
import "./theme/sharedChrome.css";
import "./theme/homeDesign.css";
import type { GameDef } from "./games/gameTypes";
import { isGameAvailable } from "./games/maintenance";
import { GameRules } from "./components/shell/GameRules";
import { AppConfirmDialogs } from "./components/shell/AppConfirmDialogs";
import { AppBackdrop } from "./components/shell/AppBackdrop";
import { DevNoticeDialog } from "./components/shell/DevNoticeDialog";
import { NameOnboardingScreen } from "./components/shell/NameOnboardingScreen";
import { ScreenFade } from "./components/ui/ScreenFade";
import { AppHeader } from "./components/shell/AppHeader";
import { HeroBackdrop } from "./components/shell/Hero";
import { ModePickerBackdrop } from "./components/shell/ModePicker";
import { getStoredPlayerName, setStoredPlayerName } from "./features/multiplayer/utils/playerName";
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
import { setAppInGame } from "./hooks/appActivity";
import { readLocalFlag, setLocalFlag } from "./utils/localFlag";
import type { AppOutletContext } from "./pages/AppOutletContext";

const DEV_NOTICE_SEEN_KEY = "impostorgame:devNoticeSeen";

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

  const { curtain, withCurtain, withAsyncCurtain, settleAsyncCurtain, stepKey, stepDirection } = useStepTransition({
    gameId: session.gameId,
    groupFlow: session.groupFlow,
    game: session.game,
    mode: session.mode,
  });

  const { confirmGoBack, goHome, pickGame, startGroupFlow } = useAppShell(session, dialogs, headerUI, withCurtain);

  const {
    gameId,
    setMode,
    mode,
    game,
    groupFlow,
    groupIntent,
    pendingGroupJoinCode,
    switchToGroupJoin,
    setRoomCode,
    setGroupCode,
    groupAttached,
    setGroupAttached,
    inGameView,
    setRoomPhase,
    handleRoomGameType,
    GAME_LIST,
  } = session;
  const { exposeReturnToGroup, exposeLocalGameBack, exposeLocalGameReset, localGameResetRef, returnToGroupRef } = bridgeRefs;
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

  const [showDevNotice, setShowDevNotice] = useState(() => !readLocalFlag(DEV_NOTICE_SEEN_KEY));

  const dismissDevNotice = () => {
    setLocalFlag(DEV_NOTICE_SEEN_KEY);
    setShowDevNotice(false);
  };

  // Asked once, right when the app is first opened — saved locally so
  // nothing downstream (creating/joining a room or group) ever has to ask
  // for it again. Editable later from the home screen ("Cambiar" link).
  const [playerName, setPlayerName] = useState(() => getStoredPlayerName());

  const savePlayerName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setStoredPlayerName(trimmed);
    setPlayerName(trimmed);
  };

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
  const outletContext: AppOutletContext = useMemo(
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

        // Paso "picker" (home): el navbar necesita fondo a todo lo ancho de
        // la ventana (como una landing real), no acotado a los 480px fijos
        // que sí llevan las pantallas de juego — por eso acá el navbar vive
        // en un contenedor sin maxWidth, y solo su contenido interno (y el
        // resto de la pantalla) usan jt-home-wrap para centrarse con el
        // ancho creciente por breakpoint (theme/homeDesign.css).
        if (stepKey === "picker") {
          return (
            <div style={{ position: "relative", zIndex: 1 }}>
              {/* Hermano de <ScreenFade> (dentro de `rest`), no descendiente
                  suyo — ver el comentario en HeroBackdrop (Hero.tsx) sobre
                  por qué un fondo `position: fixed` no puede vivir adentro
                  del wrapper que ScreenFade anima con `transform`. */}
              <HeroBackdrop />
              {/* El navbar (fondo sticky) va suelto, sin jt-home-wrap acá —
                  es él mismo quien centra su contenido interno con esa clase
                  (ver AppHeader), así su fondo llega a los bordes reales de
                  la ventana en vez de cortarse en el ancho del contenido. */}
              {header}
              {/* paddingTop compensa que el navbar ahora es fixed (ver
                  AppHeader) y ya no ocupa espacio en el flujo normal — sin
                  esto, Hero/GamePicker quedarían tapados debajo suyo. 72px
                  alcanza para cubrir su altura real tanto en mobile (~57px,
                  logo achicado bajo 420px) como en desktop (~65px) con un
                  margen chico; el aire de sobra ya lo da el padding propio
                  de Hero (jt-hero-section, 40-56px) — no hace falta sumar
                  más acá o el espacio se duplica. */}
              <div className="jt-home-wrap" style={{ margin: "0 auto", padding: "72px 16px 60px" }}>
                {rest}
              </div>
            </div>
          );
        }

        // Paso "elegí cómo jugar": a diferencia de las pantallas de juego en
        // sí (formularios/lobby, pensados mobile-first a 480px fijos), acá no
        // hay nada que se vuelva incómodo si crece — así que en vez de dejar
        // 3 filas angostas nadando en espacio vacío en desktop, este paso usa
        // un contenedor propio que crece por breakpoint (jt-mode-wrap,
        // theme/modeRow.css) para que ModePicker pueda acomodar sus opciones
        // en grilla en pantallas grandes.
        if (stepKey.startsWith("modepicker-")) {
          return (
            <div className="jt-mode-wrap jt-content-pad-top" style={{ margin: "0 auto", position: "relative", zIndex: 1 }}>
              {/* Hermano de <ScreenFade> (dentro de `rest`), no descendiente
                  suyo — mismo motivo que HeroBackdrop arriba. */}
              <ModePickerBackdrop />
              {header}
              {rest}
            </div>
          );
        }

        return (
          // jt-content-pad-top compensa que el navbar de estas pantallas
          // también pasó a ser fixed (ver AppHeader) y ya no ocupa espacio en
          // el flujo normal — vive en una clase (theme/sharedChrome.css) y no
          // en `style` porque necesita crecer desde los 900px (el navbar
          // in-game crece ahí también), algo que un padding puesto por
          // `style` inline no puede hacer. `jt-round-wrap-wide` reemplaza el
          // `maxWidth: 480` fijo de S.wrap solo mientras el RoundView de un
          // juego con `wideRoundView` (GameDef) está en pantalla — el lobby/
          // ConfigPanel de ese mismo juego se queda a 480px como cualquier
          // otro, ya que no está pensado para ese ancho.
          (() => {
            const wide = inGameView && Boolean(game?.wideRoundView);
            return (
              <div
                className={`jt-content-pad-top${wide ? " jt-round-wrap-wide" : ""}`}
                style={{ ...S.wrap, ...(wide ? { maxWidth: undefined } : null), position: "relative", zIndex: 1 }}
              >
                {header}
                {rest}
              </div>
            );
          })()
        );
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
