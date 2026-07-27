import type { ReactNode } from "react";
import { Suspense } from "react";
import { Btn } from "../../components/Btn";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Toast } from "../../components/Toast";
import { ErrorBanner } from "../../components/ErrorBanner";
import type { GameDef, RoundViewProps } from "../../games/gameTypes";

// Any in-progress phase that isn't menu/lobby/group — delegated entirely to
// the active game's own RoundView, since this shell doesn't need to know
// its phase names. Covers everything else connectionPhase can be. Extracted
// verbatim out of MultiplayerGame.tsx, which still owns all of this
// screen's state (the error banner shown here is generic — a rejected
// action, wrong turn, etc — common to any game, not something each
// RoundView repeats itself).
export function RoundScreen({
  activeGame,
  roundViewProps,
  statusToast,
  onStatusToastExpire,
  reconnectBanner,
  error,
  errorKey,
  showReturnToGroup,
  confirmLeaveInstance,
  onRequestLeaveInstance,
  onLeaveInstance,
  onCancelLeaveInstance,
}: {
  activeGame: GameDef;
  roundViewProps: RoundViewProps;
  statusToast: string | null;
  onStatusToastExpire: () => void;
  reconnectBanner: ReactNode;
  error: string;
  errorKey: number;
  // Whether this room belongs to a group instance (room.groupCode !== null)
  // — a standalone room has no group screen to return to.
  showReturnToGroup: boolean;
  confirmLeaveInstance: boolean;
  onRequestLeaveInstance: () => void;
  onLeaveInstance: () => void;
  onCancelLeaveInstance: () => void;
}) {
  return (
    <div>
      <Toast message={statusToast} onExpire={onStatusToastExpire} />
      {reconnectBanner}
      <ErrorBanner message={error} flashKey={errorKey} variant="block" />

      <Suspense fallback={<p style={{ textAlign: "center", color: "#6b6490", padding: 40 }}>Cargando juego...</p>}>
        {activeGame.RoundView && <activeGame.RoundView {...roundViewProps} />}
      </Suspense>

      {showReturnToGroup && (
        <Btn variant="ghost" onClick={onRequestLeaveInstance} style={{ marginTop: 14 }}>
          👥 Volver al grupo
        </Btn>
      )}

      {confirmLeaveInstance && (
        <ConfirmDialog
          title="¿Volver al grupo?"
          message="Vas a salir de esta partida en curso y perder tu progreso. El resto puede seguir jugando sin vos."
          confirmLabel="Sí, volver"
          onConfirm={onLeaveInstance}
          onCancel={onCancelLeaveInstance}
        />
      )}
    </div>
  );
}
