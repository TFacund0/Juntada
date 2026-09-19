import { ConfirmDialog } from "../dialogs/ConfirmDialog";
import { RETURN_TO_GROUP_CONFIRM } from "../../features/multiplayer/utils/returnToGroup";

/**
 * Los cuatro `ConfirmDialog` de nivel-app (volver/resetear/salir/volver-al-
 * grupo), extraídos de App.tsx tal cual. Puramente presentacional: cada
 * `show*` decide si se monta, y el `on*` correspondiente ya trae toda la
 * lógica de qué hacer (ver App.tsx: goBack/confirmGoBack/goHome/
 * returnToGroupRef) — este componente no conoce esa lógica, solo la dispara.
 */
export function AppConfirmDialogs({
  showBackConfirm,
  isOnlineRoom,
  onConfirmGoBack,
  onCancelBackConfirm,
  showLocalResetConfirm,
  onConfirmLocalReset,
  onCancelLocalResetConfirm,
  showExitConfirm,
  groupAttached,
  onConfirmExit,
  onCancelExitConfirm,
  showReturnToGroupConfirm,
  onConfirmReturnToGroup,
  onCancelReturnToGroupConfirm,
}: {
  showBackConfirm: boolean;
  isOnlineRoom: boolean;
  onConfirmGoBack: () => void;
  onCancelBackConfirm: () => void;
  showLocalResetConfirm: boolean;
  onConfirmLocalReset: () => void;
  onCancelLocalResetConfirm: () => void;
  showExitConfirm: boolean;
  groupAttached: boolean;
  onConfirmExit: () => void;
  onCancelExitConfirm: () => void;
  showReturnToGroupConfirm: boolean;
  onConfirmReturnToGroup: () => void;
  onCancelReturnToGroupConfirm: () => void;
}) {
  return (
    <>
      {showBackConfirm && (
        <ConfirmDialog
          title="¿Volver atrás?"
          message={
            isOnlineRoom
              ? "Vas a salir de esta partida en curso. El resto puede seguir jugando sin vos."
              : "Vas a salir del juego actual y perder el progreso de esta partida."
          }
          confirmLabel="Sí, volver"
          cancelLabel="Seguir jugando"
          onConfirm={onConfirmGoBack}
          onCancel={onCancelBackConfirm}
          tone="back"
        />
      )}

      {showLocalResetConfirm && (
        <ConfirmDialog
          title="¿Volver a jugadores?"
          message="Vas a volver a la pantalla de jugadores y perder el progreso de esta partida."
          confirmLabel="Sí, volver"
          cancelLabel="Seguir jugando"
          onConfirm={onConfirmLocalReset}
          onCancel={onCancelLocalResetConfirm}
          tone="back"
        />
      )}

      {showExitConfirm && (
        <ConfirmDialog
          title="¿Volver al menú principal?"
          message={
            groupAttached
              ? "Vas a salir del grupo (y perder el progreso de esta partida, si había una en curso). Para volver vas a necesitar el código de nuevo."
              : "Vas a salir del juego actual y perder el progreso de esta partida."
          }
          confirmLabel="Sí, salir"
          cancelLabel="Seguir jugando"
          onConfirm={onConfirmExit}
          onCancel={onCancelExitConfirm}
        />
      )}

      {showReturnToGroupConfirm && (
        <ConfirmDialog
          {...RETURN_TO_GROUP_CONFIRM}
          onConfirm={onConfirmReturnToGroup}
          onCancel={onCancelReturnToGroupConfirm}
          tone="back"
        />
      )}
    </>
  );
}
