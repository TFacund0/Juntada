import { useState } from "react";
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

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {open ? (
        <>
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.7 18.7 0 0 1 5.06-5.94M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <path d="M1 1l22 22" />
        </>
      )}
    </svg>
  );
}

/**
 * Visualización grande del código de sala/grupo — tocar la card lo copia al
 * portapapeles. El código empieza oculto (enmascarado con puntos, mismo
 * largo que el código real) para que no quede a la vista de cualquiera que
 * mire la pantalla de reojo — el ojito lo revela/oculta sin afectar la
 * copia, que sigue funcionando igual esté oculto o no.
 */
export function CodeDisplay({ code, compact = false, label = "SALA" }: CodeDisplayProps) {
  const { copied, copy: copyToClipboard } = useCopyToClipboard();
  const [revealed, setRevealed] = useState(false);
  const copy = () => copyToClipboard(code);
  const displayCode = revealed ? code : "•".repeat(code.length);

  const toggleReveal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRevealed(r => !r);
  };

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
            {displayCode}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleReveal}
          aria-label={revealed ? "Ocultar código" : "Mostrar código"}
          className="text-[var(--jt-muted)] hover:text-[var(--jt-accent-strong)] transition-colors"
        >
          <EyeIcon open={revealed} />
        </button>
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
      <div className="flex items-center justify-center gap-2 mb-1.5">
        <p className="m-0 text-[11px] font-bold tracking-[0.15em] text-[var(--jt-accent)]">CÓDIGO DE {label}</p>
        <button
          type="button"
          onClick={toggleReveal}
          aria-label={revealed ? "Ocultar código" : "Mostrar código"}
          className="text-[var(--jt-muted)] hover:text-[var(--jt-accent-strong)] transition-colors"
        >
          <EyeIcon open={revealed} />
        </button>
      </div>
      <p data-testid="code-display" className="m-0 text-4xl font-extrabold tracking-[0.2em] tabular-nums text-[var(--jt-accent-strong)]">
        {displayCode}
      </p>
      <p className="mt-1.5 text-xs text-[var(--jt-muted)]">{copied ? "Copiado" : "Tocá para copiar"}</p>
    </div>
  );
}
