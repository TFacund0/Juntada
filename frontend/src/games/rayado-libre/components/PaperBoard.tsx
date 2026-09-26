import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { usePrefersReducedMotion } from "../../../components/game-kit/hooks/usePrefersReducedMotion";
import { useAnimationGate } from "../../../components/game-kit/hooks/useAnimationGate";
import { Canvas, type DrawAction, type Tool } from "./Canvas";
import { RemotePen } from "./RemotePen";
import { useClearFx } from "../hooks/useClearFx";
import type { ScribbleSound } from "../hooks/useScribbleSound";

interface PaperBoardProps {
  strokes: DrawAction[];
  interactive: boolean;
  tool?: Tool;
  onStrokeChunk?: (points: [number, number][], color: string, size: number, strokeId: number) => void;
  onFillAt?: (x: number, y: number, color: string) => void;
  /** Texto en marcador sobre la hoja vacía de quien dibuja ("Dibujá PERRO acá"); se desvanece con el primer trazo. */
  idleText?: string | null;
  /** Mostrar el marcador que sigue el trazo remoto (solo quien mira, online). */
  remotePen?: boolean;
  /** Cambia cuando la hoja se vacía por algo que no es borrar (pedir otra palabra). Ver useClearFx. */
  resetKey?: string;
  /** Contador de "¿Borrar?" confirmados en este dispositivo. Ver useClearFx. */
  clearRequest?: number;
  scribble?: ScribbleSound;
}

const TAPE = "absolute -top-[2px] z-[3] h-5 w-[70px] bg-[rgba(255,236,170,.72)] shadow-[0_1px_2px_rgba(0,0,0,.15)]";

// Al borrar todo, la hoja tiembla (y vuelve a su leve torcido de siempre).
const SHAKE: Keyframe[] = [
  { transform: "rotate(-.5deg)" },
  { transform: "rotate(-2deg) scale(.97)" },
  { transform: "rotate(1deg) scale(.99)" },
  { transform: "rotate(-.5deg)" },
];
const SHAKE_MS = 380;

/**
 * Hoja de papel del tablero: papel con textura de ruido, levemente torcida,
 * con sombra y dos tiras de cinta en las esquinas — el canvas, el texto
 * inicial de quien dibuja y el marcador remoto van encima. Va dentro del
 * contenedor que la dimensiona (ver DrawingStage), que es también el
 * ancla de las cintas.
 */
export function PaperBoard({
  strokes,
  interactive,
  tool,
  onStrokeChunk,
  onFillAt,
  idleText,
  remotePen = false,
  resetKey = "",
  clearRequest = 0,
  scribble,
}: PaperBoardProps) {
  // Se oculta apenas se apoya el lápiz, sin esperar a que el trazo vuelva del servidor.
  const [touched, setTouched] = useState(false);
  useEffect(() => setTouched(false), [idleText]);
  const idleVisible = !touched && strokes.length === 0;

  const clearFx = useClearFx(strokes, resetKey, clearRequest);
  const sheetRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const canAnimate = useAnimationGate();
  useEffect(() => {
    if (clearFx === 0 || reduced || !canAnimate()) return;
    sheetRef.current?.animate?.(SHAKE, { duration: SHAKE_MS });
    // Solo al borrar: no re-sacudir si cambia la preferencia de movimiento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearFx]);

  return (
    <>
      <div
        ref={sheetRef}
        data-rl-board
        onPointerDownCapture={() => setTouched(true)}
        className={clsx(
          // Torcido con `transform` (no `rotate`), para que la sacudida lo reemplace en vez de sumarse.
          "relative aspect-square w-full touch-none overflow-hidden rounded-[6px] bg-rl-paper [transform:rotate(-.5deg)]",
          "shadow-[0_1px_0_#e8e0cc,0_16px_34px_rgba(0,0,0,.55)]",
          "before:rl-paper-noise before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:opacity-50 before:mix-blend-multiply",
        )}
      >
        <Canvas
          strokes={strokes}
          interactive={interactive}
          tool={tool}
          onStrokeChunk={onStrokeChunk}
          onFillAt={onFillAt}
          clearFx={clearFx}
          scribble={scribble}
        />
        {idleText && (
          <div
            aria-hidden="true"
            className={clsx(
              "pointer-events-none absolute inset-0 z-[2] grid place-items-center p-[30px] text-center font-marker text-[22px] text-[#b3a98f]",
              "transition-opacity duration-300 motion-reduce:transition-none",
              idleVisible ? "opacity-100" : "opacity-0",
            )}
          >
            {idleText}
          </div>
        )}
        {remotePen && <RemotePen strokes={strokes} />}
      </div>
      <div aria-hidden="true" className={clsx(TAPE, "-left-[14px] -rotate-[34deg]")} />
      <div aria-hidden="true" className={clsx(TAPE, "-right-[14px] rotate-[36deg]")} />
    </>
  );
}
