import clsx from "clsx";
import { useCopyToClipboard } from "../../hooks/ui/useCopyToClipboard";

interface CodeDisplayProps {
  code: string;
  /** Chip chico en línea (código de sala en el header de desktop de GroupScreen) en vez de la card grande de mobile. */
  compact?: boolean;
  /** "SALA" por defecto — LobbyScreen lo pasa como "GRUPO" cuando el código mostrado es el del grupo, no el de esta sala en particular. */
  label?: string;
}

const CARD = "cursor-pointer bg-[var(--jt-accent-soft)] border-[1.5px] border-dashed border-[var(--jt-accent-border-soft)]";

/** Visualización grande del código de sala/grupo — tocarlo lo copia al portapapeles. */
export function CodeDisplay({ code, compact = false, label = "SALA" }: CodeDisplayProps) {
  const { copied, copy: copyToClipboard } = useCopyToClipboard();
  const copy = () => copyToClipboard(code);

  if (compact) {
    return (
      <div
        onClick={copy}
        className={clsx(
          "jt-glow-hover flex items-center gap-2.5 rounded-[14px] px-4 py-2 shadow-[0_10px_28px_-18px_color-mix(in_srgb,var(--jt-accent)_70%,transparent)]",
          CARD,
        )}
      >
        <div>
          <p className="m-0 text-[10px] font-bold tracking-[0.14em] text-[var(--jt-accent)]">CÓDIGO</p>
          <p
            data-testid="code-display"
            className="m-0 text-xl font-extrabold tracking-[0.14em] tabular-nums text-[var(--jt-accent-strong)]"
          >
            {code}
          </p>
        </div>
        <span className="text-[11px] font-semibold text-[var(--jt-muted)]">{copied ? "Copiado" : "Copiar"}</span>
      </div>
    );
  }

  return (
    <div
      onClick={copy}
      className={clsx(
        "jt-glow-hover jt-animate-rise rounded-2xl px-4 py-[18px] text-center shadow-[0_16px_40px_-24px_color-mix(in_srgb,var(--jt-accent)_70%,transparent)]",
        CARD,
      )}
    >
      <p className="mb-1.5 text-[11px] font-bold tracking-[0.15em] text-[var(--jt-accent)]">CÓDIGO DE {label}</p>
      <p data-testid="code-display" className="m-0 text-4xl font-extrabold tracking-[0.2em] tabular-nums text-[var(--jt-accent-strong)]">
        {code}
      </p>
      <p className="mt-1.5 text-xs text-[var(--jt-muted)]">{copied ? "Copiado" : "Tocá para copiar"}</p>
    </div>
  );
}
