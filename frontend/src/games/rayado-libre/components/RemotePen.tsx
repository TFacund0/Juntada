import { useEffect, useRef, useState } from "react";
import type { DrawAction } from "@juntada/rayado-libre-scoring";
import { useAnimationGate } from "../../../components/game-kit/hooks/useAnimationGate";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./Canvas";
import { inkAmount, penChange, penPosition, type PenTip } from "../utils/remotePen";
import { PenMarker } from "./PenMarker";

// Sin trazos nuevos durante este tiempo = dejó de dibujar (los chunks llegan cada ~60 ms).
const IDLE_HIDE_MS = 500;

/**
 * Marcador que sigue la punta del trazo que está llegando de otro jugador,
 * con la tapa y la punta del color del trazo. Se oculta cuando dejan de
 * llegar trazos, al deshacer y al borrar. La posición es en % del tablero
 * (coordenadas 800x800), así no hace falta medirlo en pantalla. El dibujo
 * es PenMarker.
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
    <PenMarker
      color={tip.color}
      visible={visible}
      smooth
      // Sigue a la punta del trazo en vivo.
      position={penPosition(tip.x, tip.y, CANVAS_WIDTH, CANVAS_HEIGHT)}
    />
  );
}
