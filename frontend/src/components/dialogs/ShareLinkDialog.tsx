import { useState } from "react";
import { Btn } from "../ui/Btn";
import { DialogFrame } from "./DialogFrame";

interface ShareLinkDialogProps {
  title: string;
  subtitle?: string;
  value: string;
  onClose: () => void;
}

// Ver comentario en QRDialog — mismo motivo de cast explícito.
const canShare = typeof (navigator as { share?: unknown }).share === "function";

/**
 * Bloque centrado (mismo marco que QRDialog) para compartir el enlace de
 * invitación como texto, en vez de como QR: muestra el link entero y
 * tocarlo lo copia, más el botón de compartir nativo cuando el navegador lo
 * soporta — misma acción de "compartir" que ya existía, separada acá del QR.
 */
export function ShareLinkDialog({ title, subtitle, value, onClose }: ShareLinkDialogProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* portapapeles no disponible — el link igual queda visible para copiarlo a mano */
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title, url: value });
    } catch {
      /* el usuario canceló la hoja de compartir — no hay nada que hacer */
    }
  };

  return (
    <DialogFrame
      onClose={onClose}
      maxWidth={360}
      textAlign="center"
      cardStyle={{ background: "var(--jt-surface)", border: "1px solid var(--jt-accent-border)" }}
    >
      <p style={{ fontWeight: 800, fontSize: 17, margin: "0 0 6px" }}>{title}</p>
      {subtitle && <p style={{ color: "var(--jt-muted)", fontSize: 13, margin: "0 0 18px", lineHeight: 1.4 }}>{subtitle}</p>}
      <div
        onClick={copyLink}
        style={{
          cursor: "pointer",
          padding: "14px 16px",
          background: "var(--jt-accent-soft)",
          borderRadius: 12,
          border: "1.5px dashed var(--jt-accent-border-soft)",
          wordBreak: "break-all",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--jt-accent-strong)",
          marginBottom: 8,
        }}
      >
        {value}
      </div>
      <p style={{ fontSize: 12, color: "var(--jt-muted)", margin: "0 0 18px" }}>{copied ? "Copiado" : "Tocá para copiar"}</p>
      {canShare && (
        <Btn variant="primary" onClick={share} style={{ marginBottom: 10 }}>
          Compartir
        </Btn>
      )}
      <Btn variant="ghost" onClick={onClose}>
        Cerrar
      </Btn>
    </DialogFrame>
  );
}
