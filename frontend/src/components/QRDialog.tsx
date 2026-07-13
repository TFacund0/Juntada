import { useState } from "react";
import { Btn } from "./Btn";
import { QRCode } from "./QRCode";

interface QRDialogProps {
  title: string;
  subtitle?: string;
  value: string;
  onClose: () => void;
}

// TS's lib.dom types navigator.share as always-defined, which defeats
// feature-detection narrowing — check via an explicit cast instead.
const canShare = typeof (navigator as { share?: unknown }).share === "function";

export function QRDialog({ title, subtitle, value, onClose }: QRDialogProps) {
  const [copied, setCopied] = useState(false);

  // Mobile browsers get the native share sheet (WhatsApp, SMS, etc.) when
  // available; everywhere else falls back to copying the link to the
  // clipboard, with a brief "Copiado" confirmation since there's no OS-level
  // feedback for that.
  const shareLink = async () => {
    if (canShare) {
      try {
        await navigator.share({ title, url: value });
      } catch {
        /* user cancelled the share sheet — nothing to do */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the QR/code above still work */
    }
  };

  return (
    <div
      onClick={onClose}
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
          maxWidth: 340,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          textAlign: "center",
        }}
      >
        <p style={{ fontWeight: 800, fontSize: 17, margin: "0 0 6px" }}>{title}</p>
        {subtitle && <p style={{ color: "#a49dc9", fontSize: 13, margin: "0 0 18px", lineHeight: 1.4 }}>{subtitle}</p>}
        <div style={{ display: "flex", justifyContent: "center", padding: 12, background: "#f2f0fb", borderRadius: 14, marginBottom: 18 }}>
          <QRCode value={value} />
        </div>
        <Btn variant="ghost" onClick={shareLink} style={{ marginBottom: 10 }}>
          {copied ? "✅ Copiado" : canShare ? "📤 Compartir enlace" : "🔗 Copiar enlace"}
        </Btn>
        <Btn variant="ghost" onClick={onClose}>
          Cerrar
        </Btn>
      </div>
    </div>
  );
}
