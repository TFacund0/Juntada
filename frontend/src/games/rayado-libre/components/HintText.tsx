import { useEffect, useMemo, useRef } from "react";
import clsx from "clsx";
import { usePrefersReducedMotion } from "../../../components/game-kit/hooks/usePrefersReducedMotion";
import { useAnimationGate } from "../../../components/game-kit/hooks/useAnimationGate";
import { hintCells, letterCount, newlyRevealed } from "../utils/hintCells";

// Letra que se acaba de revelar: cae con rebote desde arriba, en amarillo.
const REVEAL_KEYFRAMES: Keyframe[] = [{ transform: "translateY(-12px) scale(1.5)", color: "#ffe27a" }, { transform: "none" }];
const REVEAL_TIMING: KeyframeAnimationOptions = { duration: 500, easing: "cubic-bezier(.34,1.56,.64,1)" };

interface HintTextProps {
  /** Pista con "_" por letra oculta (quien adivina), o la palabra entera con `full`. */
  hint: string;
  /** Palabra completa de quien dibuja: todas las letras a la vista, subrayado verde. */
  full?: boolean;
  /** Muestra "N letras" al lado (quien dibuja no lo tiene en el texto de arriba). */
  showCount?: boolean;
  /** Se llama una vez por cada tanda de letras nuevas reveladas (para el sonido). */
  onReveal?: () => void;
}

/**
 * Pista de la palabra en la cabecera del turno: una celda por letra en
 * Permanent Marker con subrayado de color (las ocultas quedan con el
 * subrayado solo), los espacios como un hueco — compartida por quien
 * adivina online (`round.wordHint`), quien dibuja (su propia palabra, `full`)
 * y el modo local (la pista que calcula LocalGame).
 */
export function HintText({ hint, full = false, showCount = false, onReveal }: HintTextProps) {
  const cells = useMemo(() => hintCells(hint), [hint]);
  const cellRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const prevHint = useRef(hint);
  const reduced = usePrefersReducedMotion();
  const canAnimate = useAnimationGate();

  useEffect(() => {
    const fresh = full ? [] : newlyRevealed(prevHint.current, hint);
    prevHint.current = hint;
    if (fresh.length === 0 || !canAnimate()) return;
    onReveal?.();
    if (reduced) return;
    for (const i of fresh) cellRefs.current[i]?.animate?.(REVEAL_KEYFRAMES, REVEAL_TIMING);
    // Solo importa cuándo cambia la pista — no re-animar por un onReveal nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hint, full]);

  const count = letterCount(hint);
  return (
    <>
      {!full && <span className="sr-only">Pista: {hint}</span>}
      <div aria-hidden="true" className="mt-[2px] flex flex-wrap items-center gap-[5px] @min-[1000px]:justify-center">
        {cells.map((cell, i) =>
          cell.kind === "space" ? (
            <span key={i} className="w-[10px]" />
          ) : (
            <span
              key={i}
              ref={el => {
                cellRefs.current[i] = el;
              }}
              className={clsx(
                "min-h-[25px] w-[19px] border-b-[3px] text-center font-marker text-[19px] leading-[1.1]",
                "@min-[1000px]:min-h-[32px] @min-[1000px]:w-[26px] @min-[1000px]:text-[26px]",
                full ? "border-rl-r3" : "border-rl-accent-strong",
                cell.kind === "blank" ? "text-transparent" : "text-white",
              )}
            >
              {cell.char}
            </span>
          ),
        )}
        {showCount && (
          <span className="ml-1 text-xs font-bold text-rl-muted">
            {count} {count === 1 ? "letra" : "letras"}
          </span>
        )}
      </div>
    </>
  );
}
