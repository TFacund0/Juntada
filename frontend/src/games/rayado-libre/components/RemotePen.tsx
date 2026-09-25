import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { DrawAction } from "@juntada/rayado-libre-scoring";
import { useAnimationGate } from "../../../components/game-kit/hooks/useAnimationGate";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./Canvas";
import { inkAmount, penChange, type PenTip } from "../utils/remotePen";

// Sin trazos nuevos durante este tiempo = dejó de dibujar (los chunks llegan cada ~60 ms).
const IDLE_HIDE_MS = 500;

/**
 * Marcador que sigue la punta del trazo que está llegando de otro jugador,
 * con la tapa y la punta del color del trazo. Se oculta cuando dejan de
 * llegar trazos, al deshacer y al borrar. La posición es en % del tablero
 * (coordenadas 800x800), así no hace falta medirlo en pantalla; el
 * translate(-4px, -30px) apoya la punta del dibujo sobre el punto.
 */
export function RemotePen({ strokes }: { strokes: DrawAction[] }) {
  const [tip, setTip] = useState<PenTip | null>(null);
  const [visible, setVisible] = useState(false);
  const inkRef = useRef(inkAmount(strokes));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canAnimate = useAnimationGate();

  useEffect(() => {
    const change = penChange(inkRef.current, strokes);
    inkRef.current = inkAmount(strokes);
    if (change.kind === "none") return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (change.kind === "hide" || !canAnimate()) {
      setVisible(false);
      return;
    }
    setTip(change.tip);
    setVisible(true);
    hideTimer.current = setTimeout(() => setVisible(false), IDLE_HIDE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  if (!tip) return null;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 34 34"
      className={clsx(
        "pointer-events-none absolute z-[4] h-[34px] w-[34px] -translate-x-[4px] -translate-y-[30px]",
        "transition-[left,top,opacity] duration-100 ease-linear motion-reduce:transition-none",
        visible ? "opacity-100" : "opacity-0",
      )}
      // Sigue a la punta del trazo en vivo.
      style={{ left: `${(tip.x / CANVAS_WIDTH) * 100}%`, top: `${(tip.y / CANVAS_HEIGHT) * 100}%` }}
    >
      <g transform="rotate(35 17 17)">
        <rect x="12" y="-4" width="10" height="26" rx="3" fill="#3b3350" />
        <rect x="12" y="-4" width="10" height="8" rx="3" fill={tip.color} />
        <path d="M12 22 L22 22 L18.5 31 L15.5 31 Z" fill="#d9cfb8" />
        <path d="M15.5 29 L18.5 29 L17.6 33 L16.4 33 Z" fill={tip.color} />
      </g>
    </svg>
  );
}
