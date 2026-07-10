import { useState } from "react";

export function CodeDisplay({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div onClick={copy} style={{ cursor: "pointer", textAlign: "center", padding: "16px", background: "rgba(127,119,221,0.08)", borderRadius: 12, border: "1.5px dashed rgba(127,119,221,0.4)" }}>
      <p style={{ fontSize: 11, letterSpacing: "0.15em", color: "#7F77DD", marginBottom: 6, fontWeight: 700 }}>CÓDIGO DE SALA</p>
      <p style={{ fontSize: 36, fontWeight: 800, letterSpacing: "0.2em", color: "#AFA9EC", margin: 0, fontVariantNumeric: "tabular-nums" }}>{code}</p>
      <p style={{ fontSize: 12, color: "#5a5280", marginTop: 6 }}>{copied ? "Copiado" : "Tocá para copiar"}</p>
    </div>
  );
}
