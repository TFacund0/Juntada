import { useCallback } from "react";
import { clearMultiplayerSession } from "../../features/multiplayer/hooks/useMultiplayerSocket";
import type { useAppSession } from "../session/useAppSession";
import type { useAppDialogs } from "./useAppDialogs";
import type { useHeaderUI } from "../ui/useHeaderUI";

type AppSession = ReturnType<typeof useAppSession>;
type AppDialogs = ReturnType<typeof useAppDialogs>;
type HeaderUI = ReturnType<typeof useHeaderUI>;

/**
 * Composition root — NO es un wrapper que re-expone los 6 hooks hoja (eso ya
 * lo hace App.tsx llamándolos directo). Sólo implementa las acciones que de
 * verdad cruzan varios de ellos a la vez (goHome, pickGame, startGroupFlow,
 * confirmGoBack), mutando estado de sesión + curtain + header simultáneamente
 * — extraídas tal cual de useAppNavigation.ts, sólo que ahora reciben el
 * estado/setters de los hooks hoja ya instanciados por App.tsx en vez de
 * volver a llamarlos (eso duplicaría instancias de estado independientes
 * para el mismo dato).
 */
export function useAppShell(
  session: AppSession,
  dialogs: AppDialogs,
  headerUI: HeaderUI,
  withCurtain: (action: () => void, themed: boolean) => void,
) {
  // Whether a themed game's reskin (see gameTheme on GameDef) is actually
  // live right now — used below to decide whether leaving needs the
  // fade-to-black curtain or can just happen instantly.
  const themeIsLive = Boolean(session.game?.gameTheme) && (session.mode === "local" || (session.mode === "multi" && session.inRoom));

  const confirmGoBack = useCallback(() => {
    withCurtain(() => {
      if (session.mode === "multi") clearMultiplayerSession();
      session.setMode(null);
      session.setRoomCode(null);
      // Group flow jumps straight from home into multi mode with no "pick
      // mode" step in between, so going back from it goes straight home too.
      if (session.groupFlow) {
        session.setGroupFlow(false);
        session.setGroupCode(null);
      }
      dialogs.setShowBackConfirm(false);
    }, themeIsLive);
  }, [
    session.mode,
    session.groupFlow,
    session.setMode,
    session.setRoomCode,
    session.setGroupFlow,
    session.setGroupCode,
    dialogs.setShowBackConfirm,
    withCurtain,
    themeIsLive,
  ]);

  const goHome = useCallback(() => {
    withCurtain(() => {
      if (session.mode === "multi") clearMultiplayerSession();
      session.setGameId(null);
      session.setMode(null);
      session.setGroupFlow(false);
      session.setRoomCode(null);
      session.setGroupCode(null);
      headerUI.setShowRules(false);
      dialogs.setShowExitConfirm(false);
      session.setGroupAttached(false);
    }, themeIsLive);
  }, [
    session.mode,
    session.setGameId,
    session.setMode,
    session.setGroupFlow,
    session.setRoomCode,
    session.setGroupCode,
    session.setGroupAttached,
    headerUI.setShowRules,
    dialogs.setShowExitConfirm,
    withCurtain,
    themeIsLive,
  ]);

  const pickGame = useCallback(
    (id: string) => {
      // No curtain here either — picking a game from the list only sets
      // gameId, well before "Modo local"/an actual room turns its theme on.
      session.setGameId(id);
      session.setMode(null);
      session.setRoomCode(null);
      headerUI.setShowRules(false);
    },
    [session.setGameId, session.setMode, session.setRoomCode, headerUI.setShowRules],
  );

  const startGroupFlow = useCallback(
    (intent: "create" | "join") => {
      session.setGameId(null);
      session.setGroupIntent(intent);
      session.setGroupFlow(true);
      session.setGroupCode(null);
      session.setMode("multi");
      headerUI.setShowRules(false);
      headerUI.setShowProfileMenu(false);
    },
    [
      session.setGameId,
      session.setGroupIntent,
      session.setGroupFlow,
      session.setGroupCode,
      session.setMode,
      headerUI.setShowRules,
      headerUI.setShowProfileMenu,
    ],
  );

  return {
    confirmGoBack,
    goHome,
    pickGame,
    startGroupFlow,
  };
}
