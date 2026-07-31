import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { S } from "./theme/styles";
import "./theme/curtain.css";
import "./theme/sharedChrome.css";
import { GAME_LIST, getGame } from "./games/registry";
import type { GameDef } from "./games/gameTypes";
import { isUnderMaintenance } from "./games/maintenance";
import { MultiplayerGame } from "./features/multiplayer/MultiplayerGame";
import { GamePicker } from "./components/GamePicker";
import { GameRules } from "./components/GameRules";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { RETURN_TO_GROUP_CONFIRM, roomHasProgress } from "./components/ReturnToGroupButton";
import { DevNoticeDialog } from "./components/DevNoticeDialog";
import { NameOnboardingScreen } from "./components/NameOnboardingScreen";
import { AppHeader } from "./components/AppHeader";
import { ModePicker } from "./components/ModePicker";
import { clearMultiplayerSession } from "./features/multiplayer/hooks/useMultiplayerSocket";
import { getStoredPlayerName, setStoredPlayerName } from "./features/multiplayer/utils/playerName";
import { useValidJoinLink, loadActive, saveActive } from "./hooks/useActiveSession";
import { useCurtainTransition } from "./hooks/useCurtainTransition";
import { useGameTheme } from "./hooks/useGameTheme";

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP — landing = elegir juego, luego elegir modo (local/multi) para ese
// juego. No conoce reglas de ningún juego: todo sale de games/registry.js.
// ═══════════════════════════════════════════════════════════════════════════════

function GameLoading() {
  return <p style={{ textAlign: "center", color: "#6b6490", padding: 40 }}>Cargando juego...</p>;
}

export default function App() {
  const validJoinLink = useValidJoinLink();
  const linkGameId = validJoinLink?.kind === "room" ? validJoinLink.gameId : null;
  const restored = validJoinLink ? null : loadActive();
  const [gameId, setGameId] = useState<string | null>(linkGameId ?? restored?.gameId ?? null);
  const [mode, setMode] = useState<"local" | "multi" | null>(validJoinLink ? "multi" : (restored?.mode ?? null));
  // "Crear o unirme a un grupo" (or scanning a group's join link) skips
  // straight to the multiplayer shell with no game chosen yet — the group
  // screen lets any member open/join independent game instances. Not
  // persisted across a backgrounded tab like a normal session (see
  // saveActive below): once inside an instance, its gameType drives
  // onGameTypeChange and normal session restore (rejoin_group) takes over.
  const [groupFlow, setGroupFlow] = useState(() => validJoinLink?.kind === "group");
  // Which tab the multiplayer shell should land on when entering via the
  // home screen's compact group menu (tap "+" → Crear grupo / Unirme a un
  // grupo) — lets it skip the neutral menu screen and go straight there.
  const [groupIntent, setGroupIntent] = useState<"create" | "join" | undefined>(undefined);
  // Set when the room-join form detects the typed code actually belongs to
  // a group (see MultiplayerGame's onSwitchToGroup) and the player confirms
  // switching over — takes priority over a scanned link's code so the
  // group flow picks up right where the room form left off.
  const [pendingGroupJoinCode, setPendingGroupJoinCode] = useState<string | null>(null);
  const switchToGroupJoin = (code: string) => {
    setPendingGroupJoinCode(code);
    setGroupIntent("join");
    setGroupFlow(true);
  };
  // True once actually joined/created a group (not just sitting on the
  // create/join forms) — while true, "Volver" redirects to the group screen
  // instead of exiting, and "Menú principal" warns it'll leave the group
  // before actually doing so (see goBack/showExitConfirm below).
  const [groupAttached, setGroupAttached] = useState(false);
  // MultiplayerGame exposes its "return to the group screen" action here
  // (see onExposeReturnToGroup) so the global header's "Volver" button can
  // trigger it without lifting the whole group/instance state up into App.
  const returnToGroupRef = useRef<() => void>(() => {});
  const exposeReturnToGroup = useCallback((fn: () => void) => {
    returnToGroupRef.current = fn;
  }, []);
  // Same idea, for a local game that wants "Volver" to reset it back to its
  // own setup/players screen instead of exiting local mode — see
  // LocalGame's onExposeBack/onExposeReset on GameDef. The check is a pure
  // read (false once already sitting on setup, so goBack falls through to
  // the normal exit-mode confirm); the actual reset only runs once the
  // player confirms (see showLocalResetConfirm below) — never silently.
  const localGameMidMatchRef = useRef<() => boolean>(() => false);
  const exposeLocalGameBack = useCallback((fn: () => boolean) => {
    localGameMidMatchRef.current = fn;
  }, []);
  const localGameResetRef = useRef<() => void>(() => {});
  const exposeLocalGameReset = useCallback((fn: () => void) => {
    localGameResetRef.current = fn;
  }, []);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const [showRules, setShowRules] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  // "Volver" from inside a chosen mode (local or online) is one tap away
  // from the round/lobby itself and, unlike "Menú principal", had no
  // confirmation — a mis-tap silently dropped the whole match. Only that
  // branch of goBack is destructive enough to warn about; going back from
  // "elegí local u online" (mode still null) has nothing in progress to lose.
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  // "Volver" mid-match in local mode: always confirms too (see goBack) —
  // separate from showBackConfirm above since confirming here resets the
  // local game back to its players screen instead of exiting local mode.
  const [showLocalResetConfirm, setShowLocalResetConfirm] = useState(false);
  const { curtain, withCurtain, withAsyncCurtain, settleAsyncCurtain } = useCurtainTransition();
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

  const game = gameId ? (getGame(gameId) as GameDef | undefined) : null;

  // The room actually joined is the only source of truth for which game
  // this is — a stale/mismatched join link (or gameId picked before the
  // room was known) shouldn't leave the header showing the wrong game while
  // the room content underneath is correct.
  //
  // Also the signal for whether a themed game's reskin (see gameTheme on
  // GameDef) should be live: a room only exists once "Crear partida"/
  // "Unirse" actually lands, not just from picking "Multijugador online" —
  // this is null the whole time you're still on that create/join screen.
  const [inRoom, setInRoom] = useState(false);
  // Whether a themed game's reskin is actually on screen right now — used
  // to drive the body/theme-color sync effect. Computed above the
  // "!playerName" early return further down since Hooks (the effect right
  // after it) can never be called conditionally.
  const inGameView = game
    ? game.localOnly
      ? !game.comingSoon && !isUnderMaintenance(game)
      : mode === "local" || (mode === "multi" && inRoom)
    : false;
  const { activeTheme, accentColor, mutedColor, chromeVars } = useGameTheme(game, inGameView);
  // Lets goBack decide whether delegating to returnToGroupRef (see below)
  // would actually interrupt a round in progress — the same question
  // ReturnToGroupButton asks for its own in-screen control, via the same
  // shared roomHasProgress check, instead of silently leaving either way.
  const [roomPhase, setRoomPhase] = useState<string | null>(null);
  const handleRoomGameType = useCallback(
    (roomGameType: string | null) => {
      setInRoom(roomGameType !== null);
      if (roomGameType === null) {
        // No active instance (sitting on the group screen) — only relevant
        // while in the group flow, where there's no fixed gameId to fall back
        // to; a standalone room always has a gameType.
        if (groupFlow) setGameId(null);
        return;
      }
      if (roomGameType !== gameId && getGame(roomGameType)) setGameId(roomGameType);
    },
    [groupFlow, gameId],
  );

  useEffect(() => {
    saveActive(mode === "multi" && gameId ? { gameId, mode } : null);
  }, [gameId, mode]);

  useEffect(() => {
    if (!showGroupMenu) return;
    const onClickOutside = (e: MouseEvent) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) setShowGroupMenu(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showGroupMenu]);

  const [showReturnToGroupConfirm, setShowReturnToGroupConfirm] = useState(false);
  const goBack = () => {
    // Inside a group with an active instance, "Volver" just sends the
    // player back to the group screen (same as the in-lobby/in-round "👥
    // Volver al grupo" control) — no exit. Confirms first iff a round is
    // actually in progress (roomHasProgress), same check and same copy as
    // that in-screen control uses for the identical leave_instance action —
    // pressed again once already sitting on the group screen (no instance
    // left to back out of), there's nowhere left to "go back" to except
    // leaving the group, so it warns instead of doing that silently.
    if (groupAttached) {
      if (gameId) {
        if (roomHasProgress(roomPhase)) setShowReturnToGroupConfirm(true);
        else returnToGroupRef.current?.();
      } else {
        setShowExitConfirm(true);
      }
      return;
    }
    if (mode === "local" && localGameMidMatchRef.current()) {
      // A local match is in progress — confirm before resetting back to the
      // players screen, same as every other "Volver" mid-match everywhere
      // else (online room, group instance).
      setShowLocalResetConfirm(true);
      return;
    }
    if (mode === "local" || (mode === "multi" && inRoom)) {
      // Something's actually in progress (a local match, or already inside
      // an online room/lobby) — confirm before dropping it.
      setShowBackConfirm(true);
    } else if (mode === "multi") {
      // Still on the pre-room menu (create/join a code) — no room joined
      // yet, so there's nothing in progress to warn about; go straight back
      // to "elegí cómo jugar" instead of asking to confirm losing nothing.
      clearMultiplayerSession();
      setMode(null);
    } else {
      // Reskin never turns on until "Modo local" or an actual online room
      // (see inGameView/inRoom above) — with no mode chosen yet there was
      // never anything themed on screen to fade out of.
      setGameId(null);
      setShowRules(false);
    }
  };

  // Whether the themed reskin (see gameTheme on GameDef) is actually live
  // right now, for games with one — used to decide whether leaving needs
  // the fade-to-black curtain or can just happen instantly.
  const themeIsLive = Boolean(game?.gameTheme) && (mode === "local" || (mode === "multi" && inRoom));

  const confirmGoBack = () => {
    withCurtain(() => {
      if (mode === "multi") clearMultiplayerSession();
      setMode(null);
      // Group flow jumps straight from home into multi mode with no "pick
      // mode" step in between, so going back from it goes straight home too.
      if (groupFlow) setGroupFlow(false);
      setShowBackConfirm(false);
    }, themeIsLive);
  };

  const goHome = () => {
    withCurtain(() => {
      if (mode === "multi") clearMultiplayerSession();
      setGameId(null);
      setMode(null);
      setGroupFlow(false);
      setShowRules(false);
      setShowExitConfirm(false);
      setGroupAttached(false);
    }, themeIsLive);
  };

  const pickGame = (id: string) => {
    // No curtain here either — picking a game from the list only sets
    // gameId, well before "Modo local"/an actual room turns its theme on.
    setGameId(id);
    setMode(null);
    setShowRules(false);
  };

  const startGroupFlow = (intent: "create" | "join") => {
    setGameId(null);
    setGroupIntent(intent);
    setGroupFlow(true);
    setMode("multi");
    setShowRules(false);
    setShowGroupMenu(false);
  };

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
      {curtain !== "none" && <div className={`app-curtain ${curtain}`} />}
      {activeTheme?.backdropImage ? (
        <img
          aria-hidden
          src={activeTheme.backdropImage}
          alt=""
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: 0.1,
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      ) : (
        activeTheme?.backdropEmoji && (
          <div
            aria-hidden
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "60vh",
              lineHeight: 1,
              opacity: 0.07,
              color: accentColor,
              userSelect: "none",
              pointerEvents: "none",
            }}
          >
            {activeTheme.backdropEmoji}
          </div>
        )
      )}
      <div style={{ ...S.wrap, position: "relative", zIndex: 1 }}>
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

        {showRules && (game?.rules?.length ?? 0) > 0 && <GameRules rules={game!.rules} onClose={() => setShowRules(false)} />}

        {/* ── Paso 1: elegir juego (crear/unirse a un grupo vive en el "+" del header) ── */}
        {!gameId && !groupFlow && (
          <div>
            <GamePicker games={GAME_LIST as GameDef[]} onPick={pickGame} />
          </div>
        )}

        {/* ── Juego solo local (sin motor de sala online): directo al juego ── */}
        {gameId && game?.localOnly && !game.comingSoon && !isUnderMaintenance(game) && !mode && (
          <Suspense fallback={<GameLoading />}>
            <game.LocalGame />
          </Suspense>
        )}

        {/* ── Paso 2: elegir modo (solo si el juego ya está implementado y soporta online) ── */}
        {gameId && !mode && game && !game.comingSoon && !isUnderMaintenance(game) && !game.localOnly && (
          <ModePicker
            onSelectMulti={() => setMode("multi")}
            onSelectLocal={() => withCurtain(() => setMode("local"), Boolean(game?.gameTheme))}
          />
        )}

        {/* ── Paso 3: jugar ── */}
        {mode === "local" && game && (
          <Suspense fallback={<GameLoading />}>
            <game.LocalGame onExposeBack={exposeLocalGameBack} onExposeReset={exposeLocalGameReset} />
          </Suspense>
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
            runTransition={(action, themedOverride) => withAsyncCurtain(action, themedOverride ?? Boolean(game?.gameTheme))}
            onTransitionSettled={settleAsyncCurtain}
          />
        )}
      </div>

      {showDevNotice && <DevNoticeDialog onClose={dismissDevNotice} />}

      {showBackConfirm && (
        <ConfirmDialog
          title="¿Volver atrás?"
          message="Vas a salir del juego actual y perder el progreso de esta partida."
          confirmLabel="Sí, volver"
          cancelLabel="Seguir jugando"
          onConfirm={confirmGoBack}
          onCancel={() => setShowBackConfirm(false)}
        />
      )}

      {showLocalResetConfirm && (
        <ConfirmDialog
          title="¿Volver a jugadores?"
          message="Vas a volver a la pantalla de jugadores y perder el progreso de esta partida."
          confirmLabel="Sí, volver"
          cancelLabel="Seguir jugando"
          onConfirm={() => {
            setShowLocalResetConfirm(false);
            localGameResetRef.current?.();
          }}
          onCancel={() => setShowLocalResetConfirm(false)}
        />
      )}

      {showExitConfirm && (
        <ConfirmDialog
          title="¿Volver al menú principal?"
          message={
            groupAttached
              ? "Vas a salir del grupo (y perder el progreso de esta partida, si había una en curso). Para volver vas a necesitar el código de nuevo."
              : "Vas a salir del juego actual y perder el progreso de esta partida."
          }
          confirmLabel="Sí, salir"
          cancelLabel="Seguir jugando"
          onConfirm={goHome}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}

      {showReturnToGroupConfirm && (
        <ConfirmDialog
          {...RETURN_TO_GROUP_CONFIRM}
          onConfirm={() => {
            setShowReturnToGroupConfirm(false);
            returnToGroupRef.current?.();
          }}
          onCancel={() => setShowReturnToGroupConfirm(false)}
        />
      )}
    </div>
  );
}
