import { useState } from "react";
import { Btn } from "../ui/Btn";
import { DialogFrame } from "./DialogFrame";
import { QRCode } from "../ui/QRCode";

interface QRDialogProps {
  title: string;
  subtitle?: string;
  value: string;
  onClose: () => void;
}

// Los tipos de lib.dom de TS declaran navigator.share como siempre definido,
// lo que impide el narrowing por feature-detection — se chequea con un cast
// explícito en su lugar.
const canShare = typeof (navigator as { share?: unknown }).share === "function";

/** Muestra un código de sala/grupo como QR, con un botón de compartir/copiar link. */
export function QRDialog({ title, subtitle, value, onClose }: QRDialogProps) {
  const [copied, setCopied] = useState(false);

  // Los navegadores mobile reciben la hoja nativa de compartir (WhatsApp,
  // SMS, etc.) cuando está disponible; en todo el resto cae a copiar el
  // link al portapapeles, con una confirmación breve de "Copiado" ya que no
  // hay feedback a nivel de sistema operativo para eso.
  const shareLink = async () => {
    if (canShare) {
      try {
        await navigator.share({ title, url: value });
      } catch {
        /* el usuario canceló la hoja de compartir — no hay nada que hacer */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* portapapeles no disponible — el QR/código de arriba igual funcionan */
    }
  };

  return (
    <DialogFrame
      onClose={onClose}
      maxWidth={340}
      textAlign="center"
      cardStyle={{ background: "var(--jt-surface)", border: "1px solid var(--jt-accent-border)" }}
    >
      <p style={{ fontWeight: 800, fontSize: 17, margin: "0 0 6px" }}>{title}</p>
      {subtitle && <p style={{ color: "var(--jt-muted)", fontSize: 13, margin: "0 0 18px", lineHeight: 1.4 }}>{subtitle}</p>}
      <div style={{ display: "flex", justifyContent: "center", padding: 12, background: "#f2f0fb", borderRadius: 14, marginBottom: 18 }}>
        <QRCode value={value} />
      </div>
      <Btn variant="ghost" onClick={shareLink} style={{ marginBottom: 10 }}>
        {copied ? "Copiado" : canShare ? "Compartir enlace" : "Copiar enlace"}
      </Btn>
      <Btn variant="ghost" onClick={onClose}>
        Cerrar
      </Btn>
    </DialogFrame>
  );
}
