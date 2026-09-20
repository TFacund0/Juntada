import type { RefObject } from "react";
import type { GameTheme } from "../../theme/gameThemes";
import { AppBackdrop } from "./AppBackdrop";
import { WelcomeDialog } from "./WelcomeDialog";
import { AlertDialog } from "../dialogs/AlertDialog";
import { AppConfirmDialogs } from "./AppConfirmDialogs";

interface AppOverlaysProps {
  curtain: "none" | "in" | "out";
  activeTheme: GameTheme | null | undefined;
  accentColor: string | undefined;
  showWelcome: boolean;
  playerName: string;
  dismissWelcome: () => void;
  // "Fuiste expulsado del grupo" — App-level (no room/group-specific data
  // needed) porque para cuando esto se muestra ya se navegó de vuelta al
  // home real: ver useMultiplayerEntryProps' onLeaveGroup, que llama a esto
  // ANTES de goHome, así el mensaje ya está en estado cuando GroupPage se
  // desmonta. Null cuando no hay nada que mostrar.
  kickedNotice: string | null;
  dismissKickedNotice: () => void;
  showBackConfirm: boolean;
  isOnlineRoom: boolean;
  confirmGoBack: () => void;
  setShowBackConfirm: (show: boolean) => void;
  showLocalResetConfirm: boolean;
  setShowLocalResetConfirm: (show: boolean) => void;
  localGameResetRef: RefObject<() => void>;
  showExitConfirm: boolean;
  groupAttached: boolean;
  goHome: () => void;
  setShowExitConfirm: (show: boolean) => void;
  showReturnToGroupConfirm: boolean;
  setShowReturnToGroupConfirm: (show: boolean) => void;
  returnToGroupRef: RefObject<() => void>;
}

/**
 * Agrupa el backdrop, la bienvenida de primer registro y los diálogos de confirmación
 * de nivel-app. Recibe los setters/refs crudos de useAppOrchestration y
 * construye acá los closures de confirmar/cancelar — ver App.tsx y
 * AppMainContent.tsx para el mismo patrón de extracción.
 */
export function AppOverlays({
  curtain,
  activeTheme,
  accentColor,
  showWelcome,
  playerName,
  dismissWelcome,
  kickedNotice,
  dismissKickedNotice,
  showBackConfirm,
  isOnlineRoom,
  confirmGoBack,
  setShowBackConfirm,
  showLocalResetConfirm,
  setShowLocalResetConfirm,
  localGameResetRef,
  showExitConfirm,
  groupAttached,
  goHome,
  setShowExitConfirm,
  showReturnToGroupConfirm,
  setShowReturnToGroupConfirm,
  returnToGroupRef,
}: AppOverlaysProps) {
  return (
    <>
      <AppBackdrop curtain={curtain} activeTheme={activeTheme} accentColor={accentColor} />

      {showWelcome && <WelcomeDialog playerName={playerName} onClose={dismissWelcome} />}

      {kickedNotice && <AlertDialog title="Expulsado" message={kickedNotice} onClose={dismissKickedNotice} />}

      <AppConfirmDialogs
        showBackConfirm={showBackConfirm}
        isOnlineRoom={isOnlineRoom}
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
    </>
  );
}
