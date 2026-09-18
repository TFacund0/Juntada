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
    localGameMidMatchRef,
    exposeLocalGameBack,
    localGameResetRef,
    exposeLocalGameReset,
  };
}
