import { Btn } from "../ui/Btn";
import { AlertIcon } from "../ui/icons";
import { DialogFrame } from "./DialogFrame";
import "./ConfirmDialog.css";

interface AlertDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onClose: () => void;
}

const TITLE_ID = "jt-alert-title-label";

/**
 * Aviso de un solo botón ("Entendido") — a diferencia de ConfirmDialog, no
 * hay nada que confirmar/cancelar, solo algo que ya pasó y que el jugador
 * necesita ver (ej. "Fuiste expulsado del grupo") en vez de perderse en un
 * banner que puede quedar tapado por la pantalla a la que se lo redirige
 * justo después. Reusa el mismo look rojo/alerta de ConfirmDialog.css.
 */
export function AlertDialog({ title, message, confirmLabel = "Entendido", onClose }: AlertDialogProps) {
  return (
    <DialogFrame onClose={onClose} role="alertdialog" titleId={TITLE_ID} textAlign="center" cardClassName="jt-confirm-card jt-card-glow">
      <div className="jt-confirm-badge-wrap">
        <div className="jt-confirm-badge-ping jt-animate-ping" />
        <div className="jt-confirm-badge">
          <AlertIcon size={22} color="#F09595" />
        </div>
      </div>
      <p id={TITLE_ID} className="jt-confirm-title">
        {title}
      </p>
      <p className="jt-confirm-message">{message}</p>
      <div className="jt-confirm-actions">
        <Btn variant="danger" onClick={onClose} className="w-full text-[13px] py-[11px] px-5">
          {confirmLabel}
        </Btn>
      </div>
    </DialogFrame>
  );
}
