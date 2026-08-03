import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { GAME_LIST, getGame } from "../games/registry";
import { isGameAvailable } from "../games/maintenance";
import { clearMultiplayerSession } from "../features/multiplayer/hooks/useMultiplayerSocket";
import { roomHasProgress } from "../features/multiplayer/utils/returnToGroup";
import { useCurtainTransition } from "./useCurtainTransition";
import { useClickOutside } from "./useClickOutside";
import { saveActive } from "./useActiveSession";
import { parseRoute } from "./appRoutes";
import { useUrlSync } from "./useUrlSync";
import type { JoinLink } from "../features/multiplayer/utils/joinLink";

/**
 * Toda la máquina de estados de navegación de la app: qué juego/modo está
 * elegido, el flujo de grupo, las confirmaciones de "volver"/"salir", y la
 * cortina de transición entre pasos — extraída tal cual de App.tsx (que
 * ahora solo llama a este hook y renderiza en base a lo que devuelve).
 *
 * No conoce el nombre del jugador ni el tema visual (`useGameTheme`) — esos
 * siguen siendo responsabilidad de App.tsx, que combina todo para el render
 * final.
 */
export function useAppNavigation(validJoinLink: JoinLink | null, restored: { gameId: string; mode: "local" | "multi" } | null) {
  const location = useLocation();
  // Snapshot once — a direct visit/refresh of a route like /game/:id or
  // /room/:gameId/:code should seed the initial state below the same way a
  // join link or a restored session does; later navigations are handled by
  // the sync effect further down, not by re-reading this.
  const [routeInit] = useState(() => parseRoute(location.pathname));
  const linkGameId = validJoinLink?.kind === "room" ? validJoinLink.gameId : null;
  const [gameId, setGameId] = useState<string | null>(routeInit.gameId ?? linkGameId ?? restored?.gameId ?? null);
  const [mode, setMode] = useState<"local" | "multi" | null>(routeInit.mode ?? (validJoinLink ? "multi" : (restored?.mode ?? null)));
  // "Crear o unirme a un grupo" (or scanning a group's join link) skips
  // straight to the multiplayer shell with no game chosen yet — the group
  // screen lets any member open/join independent game instances. Not
  // persisted across a backgrounded tab like a normal session (see
  // saveActive in App.tsx): once inside an instance, its gameType drives
  // onGameTypeChange and normal session restore (rejoin_group) takes over.
  const [groupFlow, setGroupFlow] = useState(() => routeInit.groupFlow || validJoinLink?.kind === "group");
  // The server-assigned room/group code, once known (see onRoomCodeChange/
  // onGroupCodeChange below) — kept separate from gameId/mode/groupFlow so
  // the URL can start code-less (/room/:gameId, /group) while still on the
  // create/join form, then upgrade in place once create/join actually lands.
  const [roomCode, setRoomCode] = useState<string | null>(routeInit.mode === "multi" && !routeInit.groupFlow ? routeInit.code : null);
  const [groupCode, setGroupCode] = useState<string | null>(routeInit.groupFlow ? routeInit.code : null);
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
  // Despite the name, this drives the profile/avatar dropdown in the header
  // (AppHeader's jt-home-profile-wrap/ProfilePanel) — the actual "crear/
  // unirme a un grupo" menu is GroupMenuDropdown, a self-contained sibling
  // component with its own state. Two unrelated triggers sitting next to
  // each other in the same navbar, easy to conflate by name alone.
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
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

  const game = gameId ? getGame(gameId) : null;

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
  // to drive the body/theme-color sync effect in useGameTheme (App.tsx).
  const inGameView = game ? (game.localOnly ? isGameAvailable(game) : mode === "local" || (mode === "multi" && inRoom)) : false;
  // Lets goBack decide whether delegating to returnToGroupRef (see below)
  // would actually interrupt a round in progress (roomHasProgress) instead
  // of silently leaving either way.
  const [roomPhase, setRoomPhase] = useState<string | null>(null);
  // Read via a ref (not `gameId` directly) so this callback's identity stays
  // stable across the very setGameId calls it makes — MultiplayerGame's
  // shell effect that calls this on room.gameType change also uses it as its
  // cleanup (see there), so if this identity changed on every gameId update,
  // that cleanup/effect pair would fire back-to-back with stale/fresh
  // closures each render, alternately setting gameId back to null and
  // forward to the room's real game — an infinite ping-pong ("Maximum update
  // depth exceeded") that showed up as the header/theme visibly flicking
  // between "Juntada" and the game's own title on every entry into a themed
  // game from a group.
  const gameIdRef = useRef(gameId);
  useEffect(() => {
    gameIdRef.current = gameId;
  }, [gameId]);
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
      if (roomGameType !== gameIdRef.current && getGame(roomGameType)) setGameId(roomGameType);
    },
    [groupFlow],
  );

  useEffect(() => {
    saveActive(mode === "multi" && gameId ? { gameId, mode } : null);
  }, [gameId, mode]);

  useClickOutside(profileMenuRef, showProfileMenu, () => setShowProfileMenu(false));

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
      setRoomCode(null);
    } else {
      // Reskin never turns on until "Modo local" or an actual online room
      // (see inGameView/inRoom above) — with no mode chosen yet there was
      // never anything themed on screen to fade out of.
      setGameId(null);
      setShowRules(false);
    }
  };

  // Whether a themed game's reskin (see gameTheme on GameDef) is actually
  // live right now — used below to decide whether leaving needs the
  // fade-to-black curtain or can just happen instantly.
  const themeIsLive = Boolean(game?.gameTheme) && (mode === "local" || (mode === "multi" && inRoom));

  const confirmGoBack = () => {
    withCurtain(() => {
      if (mode === "multi") clearMultiplayerSession();
      setMode(null);
      setRoomCode(null);
      // Group flow jumps straight from home into multi mode with no "pick
      // mode" step in between, so going back from it goes straight home too.
      if (groupFlow) {
        setGroupFlow(false);
        setGroupCode(null);
      }
      setShowBackConfirm(false);
    }, themeIsLive);
  };

  const goHome = () => {
    withCurtain(() => {
      if (mode === "multi") clearMultiplayerSession();
      setGameId(null);
      setMode(null);
      setGroupFlow(false);
      setRoomCode(null);
      setGroupCode(null);
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
    setRoomCode(null);
    setShowRules(false);
  };

  const startGroupFlow = (intent: "create" | "join") => {
    setGameId(null);
    setGroupIntent(intent);
    setGroupFlow(true);
    setGroupCode(null);
    setMode("multi");
    setShowRules(false);
    setShowProfileMenu(false);
  };

  // Identifica qué "paso" de arriba está en pantalla — cambia con cada
  // transición real de vista (elegir juego → elegir modo → jugar), pero se
  // mantiene estable mientras se navega *dentro* de un paso (ej. las fases
  // internas de MultiplayerGame), así ScreenFade sólo remonta/anima en los
  // saltos que de verdad se sienten como un cambio de pantalla.
  const stepKey =
    !gameId && !groupFlow
      ? "picker"
      : gameId && game?.localOnly && isGameAvailable(game) && !mode
        ? `localonly-${gameId}`
        : gameId && !mode && game && isGameAvailable(game) && !game.localOnly
          ? `modepicker-${gameId}`
          : mode === "local" && game
            ? `local-${gameId}`
            : mode === "multi" && (gameId || groupFlow)
              ? "multi"
              : "empty";

  // Dirección del ScreenFade (App.tsx) para este cambio de paso — un rango
  // fijo por prefijo de stepKey (elegir juego → elegir modo → jugar) en vez
  // de comparar los strings enteros, ya que dos stepKey del mismo "nivel"
  // (ej. dos juegos distintos en modepicker-*) deben seguir sintiéndose como
  // un salto lateral, no como ir "para atrás". El ref guarda el stepKey
  // anterior y se actualiza recién en el efecto (después de este render),
  // así la comparación de acá arriba siempre ve el valor previo al cambio
  // actual, no el que se acaba de calcular.
  const stepRank = (key: string) =>
    key === "picker" ? 0 : key.startsWith("modepicker-") || key.startsWith("localonly-") ? 1 : key === "empty" ? 1 : 2;
  const prevStepKeyRef = useRef(stepKey);
  const stepDirection: "forward" | "back" = stepRank(stepKey) < stepRank(prevStepKeyRef.current) ? "back" : "forward";
  useEffect(() => {
    prevStepKeyRef.current = stepKey;
  }, [stepKey]);

  // Whether goBack() (right above) would show a confirmation dialog rather
  // than silently act — i.e. whether there's a live match/lobby, or a group
  // membership, that a stray browser "back" shouldn't be able to drop
  // unconfirmed. Passed to useUrlSync, which is the one that actually acts
  // on it (see there for why/how).
  const midRound = groupAttached ? (gameId ? roomHasProgress(roomPhase) : true) : mode === "local" || (mode === "multi" && inRoom);
  useUrlSync(gameId, mode, groupFlow, roomCode, groupCode, midRound, goBack);

  return {
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
    exposeReturnToGroup,
    exposeLocalGameBack,
    exposeLocalGameReset,
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
    localGameResetRef,
    showReturnToGroupConfirm,
    setShowReturnToGroupConfirm,
    returnToGroupRef,
    inRoom,
    inGameView,
    roomPhase,
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
  };
}
