import type { RefObject } from "react";
import type { GameTheme } from "../../theme/gameThemes";
import { AppBackdrop } from "./AppBackdrop";
import { DevNoticeDialog } from "./DevNoticeDialog";
import { AppConfirmDialogs } from "./AppConfirmDialogs";

interface AppOverlaysProps {
  curtain: "none" | "in" | "out";
  activeTheme: GameTheme | null | undefined;
  accentColor: string | undefined;
  showDevNotice: boolean;
  dismissDevNotice: () => void;
  showBackConfirm: boolean;
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
 * Agrupa el backdrop, el aviso de desarrollo y los diálogos de confirmación
 * de nivel-app. Recibe los setters/refs crudos de useAppOrchestration y
 * construye acá los closures de confirmar/cancelar — ver App.tsx y
 * AppMainContent.tsx para el mismo patrón de extracción.
 */
export function AppOverlays({
  curtain,
  activeTheme,
  accentColor,
  showDevNotice,
  dismissDevNotice,
  showBackConfirm,
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
    </>
  );
}
