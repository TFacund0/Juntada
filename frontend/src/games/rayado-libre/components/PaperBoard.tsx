import { useEffect, useState } from "react";
import clsx from "clsx";
import { Canvas, type DrawAction, type Tool } from "./Canvas";
import { RemotePen } from "./RemotePen";

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
}

const TAPE = "absolute -top-[2px] z-[3] h-5 w-[70px] bg-[rgba(255,236,170,.72)] shadow-[0_1px_2px_rgba(0,0,0,.15)]";

/**
 * Hoja de papel del tablero: papel con textura de ruido, levemente torcida,
 * con sombra y dos tiras de cinta en las esquinas — el canvas, el texto
 * inicial de quien dibuja y el marcador remoto van encima. Va dentro del
 * contenedor que la dimensiona (ver DrawingStage), que es también el
 * ancla de las cintas.
 */
export function PaperBoard({ strokes, interactive, tool, onStrokeChunk, onFillAt, idleText, remotePen = false }: PaperBoardProps) {
  // Se oculta apenas se apoya el lápiz, sin esperar a que el trazo vuelva del servidor.
  const [touched, setTouched] = useState(false);
  useEffect(() => setTouched(false), [idleText]);
  const idleVisible = !touched && strokes.length === 0;

  return (
    <>
      <div
        onPointerDownCapture={() => setTouched(true)}
        className={clsx(
          "relative aspect-square w-full touch-none overflow-hidden rounded-[6px] bg-rl-paper -rotate-[.5deg]",
          "shadow-[0_1px_0_#e8e0cc,0_16px_34px_rgba(0,0,0,.55)]",
          "before:rl-paper-noise before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:opacity-50 before:mix-blend-multiply",
        )}
      >
        <Canvas strokes={strokes} interactive={interactive} tool={tool} onStrokeChunk={onStrokeChunk} onFillAt={onFillAt} />
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
