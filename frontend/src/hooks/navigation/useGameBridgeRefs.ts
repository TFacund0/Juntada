import { useRef, useCallback } from "react";

/**
 * Refs imperativos que "exponen" acciones desde los componentes de juego
 * hacia arriba (header / diálogos globales) sin levantar todo su estado a
 * App — extraído tal cual de useAppNavigation.ts.
 */
export function useGameBridgeRefs() {
  // MultiplayerGame exposes its "return to the group screen" action here
  // (see onExposeReturnToGroup) so the global header's "Volver" button can
  // trigger it without lifting the whole group/instance state up into App.
  const returnToGroupRef = useRef<() => void>(() => {});
  const exposeReturnToGroup = useCallback((fn: () => void) => {
    returnToGroupRef.current = fn;
  }, []);
  // Same idea, for a standalone (groupless) room — MultiplayerGame exposes
  // its "send leave_room" action here (see onExposeLeaveRoom) so
  // useAppShell's confirmGoBack can tell the server the player is actually
  // leaving mid-match, right before it unmounts the shell and drops the
  // socket. Without this, the server only found out via the socket close a
  // moment later, going through the full 1-minute offline-kick grace period
  // instead of freeing the room up immediately.
  const leaveRoomRef = useRef<() => void>(() => {});
  const exposeLeaveRoom = useCallback((fn: () => void) => {
    leaveRoomRef.current = fn;
  }, []);
  // Same idea, generic: lets the global GameNavbar's "Jugadores" panel (host
  // only) send transfer_host/kick_player for the active room without lifting
  // room state into App — see RoomPlayersDialog and GameSessionContext's
  // RoomRoster (the read side of this same room, forwarded separately since
  // this ref only carries the write side).
  const roomActionRef = useRef<(msg: Record<string, unknown>) => void>(() => {});
  const exposeRoomAction = useCallback((fn: (msg: Record<string, unknown>) => void) => {
    roomActionRef.current = fn;
  }, []);
  // Same idea, for a local game that wants "Volver" to reset it back to its
  // own setup/players screen instead of exiting local mode — see
  // LocalGame's onExposeBack/onExposeReset on GameDef. The check is a pure
  // read (false once already sitting on setup, so goBack falls through to
  // the normal exit-mode confirm); the actual reset only runs once the
  // player confirms — never silently.
  const localGameMidMatchRef = useRef<() => boolean>(() => false);
  const exposeLocalGameBack = useCallback((fn: () => boolean) => {
    localGameMidMatchRef.current = fn;
  }, []);
  const localGameResetRef = useRef<() => void>(() => {});
  const exposeLocalGameReset = useCallback((fn: () => void) => {
    localGameResetRef.current = fn;
  }, []);

  return {
    returnToGroupRef,
    exposeReturnToGroup,
    leaveRoomRef,
    exposeLeaveRoom,
    roomActionRef,
    exposeRoomAction,
    localGameMidMatchRef,
    exposeLocalGameBack,
    localGameResetRef,
    exposeLocalGameReset,
  };
}
