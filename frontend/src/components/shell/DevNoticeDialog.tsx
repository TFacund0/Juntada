import { Btn } from "../ui/Btn";
import { DialogFrame } from "../dialogs/DialogFrame";

interface DevNoticeDialogProps {
  onClose: () => void;
}

/** Aviso único de "app en desarrollo", mostrado una vez por sesión. */
export function DevNoticeDialog({ onClose }: DevNoticeDialogProps) {
  return (
    <DialogFrame onClose={onClose} maxWidth={380} closeOnOverlayClick={false}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>🚧</div>
      <p style={{ fontWeight: 800, fontSize: 17, margin: "0 0 8px" }}>Juntada está en desarrollo</p>
      <p style={{ color: "#a49dc9", fontSize: 14, margin: "0 0 20px", lineHeight: 1.5 }}>
        Esta es una versión de prueba. Podés encontrarte con errores, desconexiones o cambios repentinos mientras seguimos mejorándola.
        ¡Gracias por tu paciencia y por probarla!
      </p>
      <Btn onClick={onClose}>Entendido, ¡a jugar!</Btn>
    </DialogFrame>
  );
}
