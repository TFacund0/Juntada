import { useState } from "react";

interface CodeDisplayProps {
  code: string;
}

/** Visualización grande del código de sala/grupo — tocarlo lo copia al portapapeles. */
export function CodeDisplay({ code }: CodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div
      onClick={copy}
      style={{
        cursor: "pointer",
        textAlign: "center",
        padding: "16px",
        background: "var(--jt-accent-soft)",
        borderRadius: 12,
        border: "1.5px dashed var(--jt-accent-border-soft)",
      }}
    >
      <p style={{ fontSize: 11, letterSpacing: "0.15em", color: "var(--jt-accent)", marginBottom: 6, fontWeight: 700 }}>CÓDIGO DE SALA</p>
      <p
        style={{
          fontSize: 36,
          fontWeight: 800,
          letterSpacing: "0.2em",
          color: "var(--jt-accent-strong)",
          margin: 0,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {code}
      </p>
      <p style={{ fontSize: 12, color: "var(--jt-muted)", marginTop: 6 }}>{copied ? "Copiado" : "Tocá para copiar"}</p>
    </div>
  );
}
