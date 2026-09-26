import { forwardRef, useImperativeHandle, useRef } from "react";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../utils/board";
import { penPosition } from "../utils/remotePen";
import { PenMarker } from "./PenMarker";

export interface OwnPenHandle {
  /** Punta del lápiz en coordenadas del tablero (800x800); `null` = se levantó. */
  move: (point: [number, number] | null) => void;
}

/**
 * El marcador sobre la hoja de quien dibuja, siguiendo su propio lápiz
 * mientras lo tiene apoyado. Se mueve tocando el estilo del elemento en cada
 * `pointermove` (ver Canvas) en vez de con estado de React, para no
 * re-renderizar el tablero a cada movimiento.
 */
export const OwnPen = forwardRef<OwnPenHandle, { color: string }>(function OwnPen({ color }, ref) {
  const svgRef = useRef<SVGSVGElement>(null);
  useImperativeHandle(ref, () => ({
    move: point => {
      const el = svgRef.current;
      if (!el) return;
      if (!point) {
        el.style.opacity = "";
        return;
      }
      const { left, top } = penPosition(point[0], point[1], CANVAS_WIDTH, CANVAS_HEIGHT);
      el.style.left = left;
      el.style.top = top;
      el.style.opacity = "1";
    },
  }));
  return <PenMarker ref={svgRef} color={color} visible={false} />;
});
