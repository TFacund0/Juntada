import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";

interface CodeDisplayProps {
  code: string;
  /** Chip chico en línea (código de sala en el header de desktop de GroupScreen) en vez de la card grande de mobile. */
  compact?: boolean;
  /** "SALA" por defecto — LobbyScreen lo pasa como "GRUPO" cuando el código mostrado es el del grupo, no el de esta sala en particular. */
  label?: string;
}

/** Visualización grande del código de sala/grupo — tocarlo lo copia al portapapeles. */
export function CodeDisplay({ code, compact = false, label = "SALA" }: CodeDisplayProps) {
  const { copied, copy: copyToClipboard } = useCopyToClipboard();
  const copy = () => copyToClipboard(code);

  if (compact) {
    return (
      <div
        onClick={copy}
        className="jt-glow-hover"
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 16px",
          background: "var(--jt-accent-soft)",
          borderRadius: 14,
          border: "1.5px dashed var(--jt-accent-border-soft)",
        }}
      >
        <div>
          <p style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--jt-accent)", margin: 0, fontWeight: 700 }}>CÓDIGO</p>
          <p
            data-testid="code-display"
            style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "0.14em",
              color: "var(--jt-accent-strong)",
              margin: 0,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {code}
          </p>
        </div>
        <span style={{ fontSize: 11, color: "var(--jt-muted)", fontWeight: 600 }}>{copied ? "Copiado" : "Copiar"}</span>
      </div>
    );
  }

  return (
    <div
      onClick={copy}
      className="jt-glow-hover jt-animate-rise"
      style={{
        cursor: "pointer",
        textAlign: "center",
        padding: "16px",
        background: "var(--jt-accent-soft)",
        borderRadius: 12,
        border: "1.5px dashed var(--jt-accent-border-soft)",
      }}
    >
      <p style={{ fontSize: 11, letterSpacing: "0.15em", color: "var(--jt-accent)", marginBottom: 6, fontWeight: 700 }}>
        CÓDIGO DE {label}
      </p>
      <p
        data-testid="code-display"
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
