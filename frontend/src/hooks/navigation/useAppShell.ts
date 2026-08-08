import { clearMultiplayerSession } from "../features/multiplayer/hooks/useMultiplayerSocket";
import type { useAppSession } from "./useAppSession";
import type { useAppDialogs } from "./useAppDialogs";
import type { useHeaderUI } from "./useHeaderUI";

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

  const confirmGoBack = () => {
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
  };

  const goHome = () => {
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
  };

  const pickGame = (id: string) => {
    // No curtain here either — picking a game from the list only sets
    // gameId, well before "Modo local"/an actual room turns its theme on.
    session.setGameId(id);
    session.setMode(null);
    session.setRoomCode(null);
    headerUI.setShowRules(false);
  };

  const startGroupFlow = (intent: "create" | "join") => {
    session.setGameId(null);
    session.setGroupIntent(intent);
    session.setGroupFlow(true);
    session.setGroupCode(null);
    session.setMode("multi");
    headerUI.setShowRules(false);
    headerUI.setShowProfileMenu(false);
  };

  return {
    confirmGoBack,
    goHome,
    pickGame,
    startGroupFlow,
  };
}
