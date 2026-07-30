import { Btn } from "./Btn";
import { DialogFrame } from "./DialogFrame";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Ícono de alerta (Feather-style, trazo) para el badge del diálogo. */
function AlertIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#F09595"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/**
 * Diálogo genérico de "¿estás seguro?" con confirmar/cancelar — usado en
 * toda la app (salir de una partida, del grupo, etc.). Centrado, con un
 * ícono de alerta arriba y texto más chico que antes: el título/mensaje
 * grandes y alineados a la izquierda leían más como un encabezado de
 * pantalla que como un aviso puntual.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <DialogFrame onClose={onCancel} textAlign="center">
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: "rgba(226,75,74,0.15)",
          border: "1px solid rgba(226,75,74,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 14px",
        }}
      >
        <AlertIcon />
      </div>
      <p style={{ fontWeight: 800, fontSize: 15, margin: "0 0 6px" }}>{title}</p>
      <p style={{ color: "var(--jt-muted-text, #a49dc9)", fontSize: 13, margin: "0 0 20px", lineHeight: 1.5 }}>{message}</p>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="ghost" onClick={onCancel} style={{ fontSize: 13, padding: "11px 20px" }}>
          {cancelLabel}
        </Btn>
        <Btn variant="danger" onClick={onConfirm} style={{ fontSize: 13, padding: "11px 20px" }}>
          {confirmLabel}
        </Btn>
      </div>
    </DialogFrame>
  );
}
