import { clearMultiplayerSession } from "../features/multiplayer/hooks/useMultiplayerSocket";
import { roomHasProgress } from "../features/multiplayer/utils/returnToGroup";
import { useUrlSync } from "./useUrlSync";

interface UseBackNavigationArgs {
  gameId: string | null;
  mode: "local" | "multi" | null;
  groupFlow: boolean;
  roomCode: string | null;
  groupCode: string | null;
  groupAttached: boolean;
  roomPhase: string | null;
  inRoom: boolean;
  // MutableRefObject-shaped (never null once mounted, per useGameBridgeRefs'
  // useRef(fn) initializers) rather than React's RefObject<T> (which types
  // `current` as possibly null) — matches the actual refs passed in.
  returnToGroupRef: { current: () => void };
  localGameMidMatchRef: { current: () => boolean };
  setMode: (mode: "local" | "multi" | null) => void;
  setRoomCode: (code: string | null) => void;
  setGameId: (id: string | null) => void;
  setShowRules: (show: boolean) => void;
  setShowExitConfirm: (show: boolean) => void;
  setShowBackConfirm: (show: boolean) => void;
  setShowLocalResetConfirm: (show: boolean) => void;
  setShowReturnToGroupConfirm: (show: boolean) => void;
}

/**
 * Guarda completa de "volver" — extraída tal cual de useAppNavigation.ts:
 * `midRound` (si un stray "back" del navegador debería confirmarse en vez de
 * dropear progreso en silencio), `goBack` (qué hace un tap real en "Volver"),
 * y la llamada interna a `useUrlSync` que las conecta al historial del
 * browser (checkpoint push + useBlocker). Nadie fuera de este hook necesita
 * saber que useUrlSync existe.
 */
export function useBackNavigation({
  gameId,
  mode,
  groupFlow,
  roomCode,
  groupCode,
  groupAttached,
  roomPhase,
  inRoom,
  returnToGroupRef,
  localGameMidMatchRef,
  setMode,
  setRoomCode,
  setGameId,
  setShowRules,
  setShowExitConfirm,
  setShowBackConfirm,
  setShowLocalResetConfirm,
  setShowReturnToGroupConfirm,
}: UseBackNavigationArgs) {
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
        else returnToGroupRef.current();
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

  // Whether goBack() (right above) would show a confirmation dialog rather
  // than silently act — i.e. whether there's a live match/lobby, or a group
  // membership, that a stray browser "back" shouldn't be able to drop
  // unconfirmed. Passed to useUrlSync, which is the one that actually acts
  // on it (see there for why/how).
  const midRound = groupAttached ? (gameId ? roomHasProgress(roomPhase) : true) : mode === "local" || (mode === "multi" && inRoom);
  useUrlSync(gameId, mode, groupFlow, roomCode, groupCode, midRound, goBack);

  return { midRound, goBack };
}
