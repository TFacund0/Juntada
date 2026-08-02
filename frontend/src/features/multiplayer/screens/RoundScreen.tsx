import type { ReactNode } from "react";
import { Suspense } from "react";
import { Toast } from "../../../components/ui/Toast";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { GameLoadErrorBoundary } from "../../../components/shell/GameLoadErrorBoundary";
import type { GameDef, RoundViewProps } from "../../../games/gameTypes";

// Any in-progress phase that isn't menu/lobby/group — delegated entirely to
// the active game's own RoundView, since this shell doesn't need to know
// its phase names. Covers everything else connectionPhase can be. Extracted
// verbatim out of MultiplayerGame.tsx, which still owns all of this
// screen's state (the error banner shown here is generic — a rejected
// action, wrong turn, etc — common to any game, not something each
// RoundView repeats itself).
//
// "Volver al grupo" durante una ronda no vive acá — es la flecha "Volver"
// del navbar (AppHeader), que ya delega a la misma acción (goBack en
// hooks/useAppNavigation.ts, vía returnToGroupRef) con su propia
// confirmación cuando corresponde.
export function RoundScreen({
  activeGame,
  roundViewProps,
  statusToast,
  onStatusToastExpire,
  reconnectBanner,
  error,
  errorKey,
}: {
  activeGame: GameDef;
  roundViewProps: RoundViewProps;
  statusToast: string | null;
  onStatusToastExpire: () => void;
  reconnectBanner: ReactNode;
  error: string;
  errorKey: number;
}) {
  return (
    <div>
      <Toast message={statusToast} onExpire={onStatusToastExpire} />
      {reconnectBanner}
      <ErrorBanner message={error} flashKey={errorKey} variant="block" />

      <GameLoadErrorBoundary key={activeGame.id}>
        <Suspense fallback={<p style={{ textAlign: "center", color: "#6b6490", padding: 40 }}>Cargando juego...</p>}>
          {activeGame.RoundView && <activeGame.RoundView {...roundViewProps} />}
        </Suspense>
      </GameLoadErrorBoundary>
    </div>
  );
}
