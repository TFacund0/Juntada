import { forwardRef, type CSSProperties } from "react";
import clsx from "clsx";

interface PenMarkerProps {
  color: string;
  visible: boolean;
  /** Posición (`left`/`top` en %); sin esto la pone quien lo usa directo sobre el elemento (ver OwnPen). */
  position?: CSSProperties;
  /** Deslizarse entre puntos (el trazo remoto llega a saltos); el propio sigue al puntero sin transición. */
  smooth?: boolean;
}

/**
 * El dibujo del marcador sobre la hoja: tapa y punta del color del trazo. El
 * translate(-4px, -30px) apoya la punta del dibujo sobre el punto. Solo
 * presentación — lo mueven RemotePen (trazo de otro) y OwnPen (el propio).
 */
export const PenMarker = forwardRef<SVGSVGElement, PenMarkerProps>(function PenMarker({ color, visible, position, smooth = false }, ref) {
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      viewBox="0 0 34 34"
      className={clsx(
        "pointer-events-none absolute z-[4] h-[34px] w-[34px] -translate-x-[4px] -translate-y-[30px]",
        smooth && "transition-[left,top,opacity] duration-100 ease-linear motion-reduce:transition-none",
        visible ? "opacity-100" : "opacity-0",
      )}
      style={position}
    >
      <g transform="rotate(35 17 17)">
        <rect x="12" y="-4" width="10" height="26" rx="3" fill="#3b3350" />
        <rect x="12" y="-4" width="10" height="8" rx="3" fill={color} />
        <path d="M12 22 L22 22 L18.5 31 L15.5 31 Z" fill="#d9cfb8" />
        <path d="M15.5 29 L18.5 29 L17.6 33 L16.4 33 Z" fill={color} />
      </g>
    </svg>
  );
});
