import { Btn } from "./Btn";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,12,29,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#171329",
          border: "1px solid rgba(127,119,221,0.3)",
          borderRadius: 16,
          padding: "24px 20px",
          maxWidth: 360,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <p style={{ fontWeight: 800, fontSize: 17, margin: "0 0 8px" }}>{title}</p>
        <p style={{ color: "#a49dc9", fontSize: 14, margin: "0 0 20px", lineHeight: 1.4 }}>{message}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Btn>
          <Btn variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}
