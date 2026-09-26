import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

// Cuánto espera "¿Borrar?" el segundo toque antes de volver a 🗑.
const CONFIRM_MS = 2500;

const ACTION = clsx(
  "grid h-10 min-w-10 cursor-pointer place-items-center rounded-xl border border-rl-card-border bg-rl-card px-2 text-base",
  "disabled:cursor-default disabled:opacity-35",
  "@max-[360px]/stage:h-9 @max-[360px]/stage:min-w-[34px] @max-[360px]/stage:px-[6px] landscape-short:h-7",
);

interface PaletteActionsProps {
  /** Hay algo en la hoja: habilita Deshacer y deja armar el borrado. */
  hasDrawing: boolean;
  onUndo: () => void;
  /** El primer toque de Borrar: pide confirmación. */
  onArmClear: () => void;
  /** El segundo toque de Borrar, dentro de los 2,5 s. */
  onClear: () => void;
}

/**
 * Deshacer y Borrar, a la derecha de la segunda fila. Borrar pide
 * confirmación: el primer toque lo pone rojo con "¿Borrar?" por 2,5 s y
 * recién el segundo borra, así no se pierde el dibujo por un toque de más.
 */
export function PaletteActions({ hasDrawing, onUndo, onArmClear, onClear }: PaletteActionsProps) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disarm = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setArmed(false);
  };
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleClear = () => {
    if (!hasDrawing) return;
    if (!armed) {
      setArmed(true);
      timerRef.current = setTimeout(disarm, CONFIRM_MS);
      onArmClear();
      return;
    }
    disarm();
    onClear();
  };

  return (
    <>
      <button
        type="button"
        onClick={onUndo}
        disabled={!hasDrawing}
        title="Deshacer (Ctrl+Z)"
        aria-label="Deshacer"
        // Con la fila partida en dos (ver Palette), Deshacer y Borrar van a la derecha.
        className={clsx(ACTION, "@min-[700px]/stage:@max-[372px]/palette:ml-auto")}
      >
        <span aria-hidden="true">↶</span>
      </button>
      <button
        type="button"
        onClick={handleClear}
        title="Borrar todo"
        aria-label={armed ? "¿Borrar? Tocá de nuevo para borrar todo" : "Borrar todo"}
        className={clsx(ACTION, armed && "border-rl-danger bg-rl-danger text-xs font-extrabold text-white")}
      >
        {armed ? "¿Borrar?" : <span aria-hidden="true">🗑</span>}
      </button>
    </>
  );
}
