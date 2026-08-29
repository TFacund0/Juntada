import { Btn } from "../ui/Btn";
import { DialogFrame } from "../dialogs/DialogFrame";
import "./DevNoticeDialog.css";

interface DevNoticeDialogProps {
  onClose: () => void;
}

const TITLE_ID = "jt-devnotice-title-label";

/** Aviso único de "app en desarrollo", mostrado una vez por sesión. */
export function DevNoticeDialog({ onClose }: DevNoticeDialogProps) {
  return (
    <DialogFrame
      onClose={onClose}
      titleId={TITLE_ID}
      maxWidth={380}
      closeOnOverlayClick={false}
      textAlign="center"
      cardClassName="jt-devnotice-card jt-card-glow"
    >
      <div className="jt-devnotice-badge">🚧</div>
      <p id={TITLE_ID} className="jt-devnotice-title">
        Juntada está en desarrollo
      </p>
      <p className="jt-devnotice-message">
        Esta es una versión de prueba. Podés encontrarte con errores, desconexiones o cambios repentinos mientras seguimos mejorándola.
        ¡Gracias por tu paciencia y por probarla!
      </p>
      <Btn onClick={onClose}>Entendido, ¡a jugar!</Btn>
    </DialogFrame>
  );
}
