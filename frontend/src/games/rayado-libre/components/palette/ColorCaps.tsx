import { useEffect, useRef } from "react";
import clsx from "clsx";
import { usePrefersReducedMotion } from "../../../../components/game-kit/hooks/usePrefersReducedMotion";
import { PALETTE, PALETTE_NAMES } from "../../utils/palette";

// La tapita elegida rebota al tocarla (sube un poco más y vuelve a su lugar).
const BOUNCE: Keyframe[] = [{ transform: "translateY(-6px)" }, { transform: "translateY(-11px)" }, { transform: "translateY(-6px)" }];
const BOUNCE_MS = 200;

interface ColorCapsProps {
  color: string;
  onSelect: (index: number) => void;
  /** Cambia en cada elección de color (con clic o con atajo): dispara el rebote de la tapita elegida. */
  bounce: number;
}

/**
 * Fila de colores como tapitas de marcador (`.caps` / `.cap` de la
 * referencia). La elegida sube 6 px y muestra un puntito blanco debajo; en
 * celular horizontal van en columna y la elegida se corre a la derecha, con
 * el puntito a su derecha.
 */
export function ColorCaps({ color, onSelect, bounce }: ColorCapsProps) {
  const capRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (bounce === 0 || reduced) return;
    capRefs.current[PALETTE.indexOf(color as (typeof PALETTE)[number])]?.animate?.(BOUNCE, { duration: BOUNCE_MS });
    // Solo al elegir: el color ya viene actualizado en el mismo render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounce]);

  return (
    <div
      role="radiogroup"
      aria-label="Color"
      className={clsx(
        "flex justify-between gap-1 pt-[6px] @max-[360px]/stage:gap-[2px]",
        "landscape-short:flex-col landscape-short:justify-start landscape-short:gap-[3px] landscape-short:pb-0 landscape-short:pl-0 landscape-short:pr-[6px] landscape-short:pt-0",
      )}
    >
      {PALETTE.map((c, i) => {
        const selected = c === color;
        return (
          <button
            key={c}
            ref={el => {
              capRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={PALETTE_NAMES[i]}
            title={`${PALETTE_NAMES[i]} (${i + 1})`}
            onClick={() => onSelect(i)}
            className={clsx(
              "relative h-[30px] max-w-[34px] flex-1 cursor-pointer rounded-[9px_9px_13px_13px] border-0 p-0",
              "transition-[transform] duration-150 ease-[cubic-bezier(.3,1.5,.5,1)] motion-reduce:transition-none",
              "@min-[1000px]/stage:h-[34px] @min-[1000px]/stage:max-w-[40px]",
              "landscape-short:h-6 landscape-short:w-7 landscape-short:max-w-none landscape-short:flex-none landscape-short:rounded-[7px_12px_12px_7px]",
              c === "#ffffff"
                ? "shadow-[inset_0_-5px_0_rgba(0,0,0,.12),inset_0_0_0_1px_rgba(0,0,0,.2)]"
                : "shadow-[inset_0_-5px_0_rgba(0,0,0,.22),inset_0_2px_0_rgba(255,255,255,.3)]",
              selected && [
                "[transform:translateY(-6px)] landscape-short:[transform:translateX(5px)]",
                "after:absolute after:bottom-[-9px] after:left-1/2 after:-ml-[3px] after:size-[6px] after:rounded-full after:bg-white after:content-['']",
                "landscape-short:after:left-auto landscape-short:after:right-[-9px] landscape-short:after:bottom-1/2 landscape-short:after:m-0 landscape-short:after:-mb-[3px]",
              ],
            )}
            // Color de la tapita: es el propio color de la paleta.
            style={{ background: c }}
          />
        );
      })}
    </div>
  );
}
