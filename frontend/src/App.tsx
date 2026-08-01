import { useState, useEffect, Suspense } from "react";
import { S } from "./theme/styles";
import "./theme/curtain.css";
import "./theme/sharedChrome.css";
import "./theme/homeDesign.css";
import type { GameDef } from "./games/gameTypes";
import { isGameAvailable } from "./games/maintenance";
import { MultiplayerGame } from "./features/multiplayer/MultiplayerGame";
import { GamePicker } from "./components/shell/GamePicker";
import { Hero } from "./components/shell/Hero";
import { GameRules } from "./components/shell/GameRules";
import { AppConfirmDialogs } from "./components/shell/AppConfirmDialogs";
import { AppBackdrop } from "./components/shell/AppBackdrop";
import { DevNoticeDialog } from "./components/shell/DevNoticeDialog";
import { GameLoadErrorBoundary } from "./components/shell/GameLoadErrorBoundary";
import { NameOnboardingScreen } from "./components/shell/NameOnboardingScreen";
import { ScreenFade } from "./components/ui/ScreenFade";
import { Spinner } from "./components/ui/Spinner";
import { AppHeader } from "./components/shell/AppHeader";
import { ModePicker } from "./components/shell/ModePicker";
import { getStoredPlayerName, setStoredPlayerName } from "./features/multiplayer/utils/playerName";
import { loadActive } from "./hooks/useActiveSession";
import { useValidJoinLink } from "./features/multiplayer/hooks/useValidJoinLink";
import { useGameTheme } from "./hooks/useGameTheme";
import { useAppNavigation } from "./hooks/useAppNavigation";
import { setAppInGame } from "./hooks/appActivity";

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP — landing = elegir juego, luego elegir modo (local/multi) para ese
// juego. No conoce reglas de ningún juego: todo sale de games/registry.js.
// ═══════════════════════════════════════════════════════════════════════════════

function GameLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: 40 }}>
      <Spinner />
      <p style={{ margin: 0, color: "var(--jt-muted-text, #6b6490)", fontSize: 14 }}>Cargando juego...</p>
    </div>
  );
}

export default function App() {
  const validJoinLink = useValidJoinLink();
  const restored = validJoinLink ? null : loadActive();
  const nav = useAppNavigation(validJoinLink, restored);
  const {
    gameId,
    setMode,
    mode,
    game,
    groupFlow,
    groupIntent,
    pendingGroupJoinCode,
    switchToGroupJoin,
    groupAttached,
    setGroupAttached,
    exposeReturnToGroup,
    exposeLocalGameBack,
    exposeLocalGameReset,
    showGroupMenu,
    setShowGroupMenu,
    groupMenuRef,
    showRules,
    setShowRules,
    showExitConfirm,
    setShowExitConfirm,
    showBackConfirm,
    setShowBackConfirm,
    showLocalResetConfirm,
    setShowLocalResetConfirm,
    localGameResetRef,
    showReturnToGroupConfirm,
    setShowReturnToGroupConfirm,
    returnToGroupRef,
    inGameView,
    setRoomPhase,
    handleRoomGameType,
    curtain,
    withCurtain,
    withAsyncCurtain,
    settleAsyncCurtain,
    goBack,
    confirmGoBack,
    goHome,
    pickGame,
    startGroupFlow,
    stepKey,
    stepDirection,
    GAME_LIST,
  } = nav;

  const [showDevNotice, setShowDevNotice] = useState(() => {
    try {
      return !localStorage.getItem("impostorgame:devNoticeSeen");
    } catch {
      return false;
    }
  });

  const dismissDevNotice = () => {
    try {
      localStorage.setItem("impostorgame:devNoticeSeen", "1");
    } catch {
      /* storage unavailable */
    }
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
  const { activeTheme, accentColor, mutedColor, chromeVars } = useGameTheme(game, inGameView);

  // Lets a pending service worker update (see useServiceWorkerUpdate) know
  // it's not safe to reload right now — a round can last just a few
  // seconds, and yanking the page mid-tap would lose whatever the player
  // was doing. useEffect (not a direct call in the render body) so this
  // only fires on an actual mode change, not every re-render.
  useEffect(() => {
    setAppInGame(inGameView);
  }, [inGameView]);

  if (!playerName) return <NameOnboardingScreen onSave={savePlayerName} />;

  return (
    <div
      style={{
        ...S.app,
        ...activeTheme?.app,
        ...chromeVars,
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
            game={game}
            accentColor={accentColor}
            mutedColor={mutedColor}
            playerName={playerName}
            onSavePlayerName={savePlayerName}
            onBack={goBack}
            onExit={() => setShowExitConfirm(true)}
            showGroupMenu={showGroupMenu}
            onToggleGroupMenu={() => setShowGroupMenu(v => !v)}
            groupMenuRef={groupMenuRef}
            onStartGroupFlow={startGroupFlow}
            showRules={showRules}
            onToggleRules={() => setShowRules(v => !v)}
          />
        );
        const rest = (
          <>
            {showRules && (game?.rules?.length ?? 0) > 0 && <GameRules rules={game!.rules} onClose={() => setShowRules(false)} />}

            <ScreenFade transitionKey={stepKey} direction={stepDirection}>
              {/* ── Paso 1: elegir juego (crear/unirse a un grupo vive en el "+" del header) ── */}
              {!gameId && !groupFlow && (
                <div>
                  <Hero gameCount={(GAME_LIST as GameDef[]).filter(isGameAvailable).length} />
                  <div id="jt-games">
                    <GamePicker games={GAME_LIST as GameDef[]} onPick={pickGame} />
                  </div>
                </div>
              )}

              {/* ── Juego solo local (sin motor de sala online): directo al juego ── */}
              {gameId && game?.localOnly && isGameAvailable(game) && !mode && (
                <GameLoadErrorBoundary key={gameId}>
                  <Suspense fallback={<GameLoading />}>
                    <game.LocalGame />
                  </Suspense>
                </GameLoadErrorBoundary>
              )}

              {/* ── Paso 2: elegir modo (solo si el juego ya está implementado y soporta online) ── */}
              {gameId && !mode && game && isGameAvailable(game) && !game.localOnly && (
                <ModePicker onSelectMulti={() => setMode("multi")} onSelectLocal={() => withCurtain(() => setMode("local"))} />
              )}

              {/* ── Paso 3: jugar ── */}
              {mode === "local" && game && (
                <GameLoadErrorBoundary key={gameId}>
                  <Suspense fallback={<GameLoading />}>
                    <game.LocalGame onExposeBack={exposeLocalGameBack} onExposeReset={exposeLocalGameReset} />
                  </Suspense>
                </GameLoadErrorBoundary>
              )}
              {mode === "multi" && (gameId || groupFlow) && (
                <MultiplayerGame
                  entryKind={groupFlow ? "group" : "room"}
                  gameId={gameId}
                  playerName={playerName}
                  onChangeName={savePlayerName}
                  initialJoinCode={pendingGroupJoinCode ?? validJoinLink?.code}
                  initialGroupIntent={groupIntent}
                  onGameTypeChange={handleRoomGameType}
                  onRoomPhaseChange={setRoomPhase}
                  onLeaveGroup={goHome}
                  onExitRoomEntry={goBack}
                  onGoHome={goHome}
                  onSwitchToGroup={switchToGroupJoin}
                  onGroupAttachedChange={setGroupAttached}
                  onExposeReturnToGroup={exposeReturnToGroup}
                  // `game` only reflects the *route's* gameId (set upfront for a
                  // standalone room) — a group instance's game is picked from
                  // inside the group screen itself, so `game` is still whatever it
                  // was before (often null) at the exact moment a group create/
                  // join fires. Callers there know the target game synchronously
                  // (the picker's own gameId, or the instance's gameType) and pass
                  // it as `themedOverride` instead of relying on this closure.
                  runTransition={action => withAsyncCurtain(action)}
                  onTransitionSettled={settleAsyncCurtain}
                />
              )}
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
          // `style` inline no puede hacer.
          <div className="jt-content-pad-top" style={{ ...S.wrap, position: "relative", zIndex: 1 }}>
            {header}
            {rest}
          </div>
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
