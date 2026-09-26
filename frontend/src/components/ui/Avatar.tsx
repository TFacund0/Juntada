import { memo } from "react";
import clsx from "clsx";

const AVATAR_COLORS = ["#534AB7", "#0F6E56", "#993C1D", "#185FA5", "#854F0B", "#993556", "#3B6D11", "#A32D2D"];

/** El color de fondo del avatar de un jugador — exportado para que un nombre pueda ir "en su color" sin repetir la paleta. */
export function avatarColor(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

interface AvatarProps {
  name: string;
  size?: number;
  /** Clases extra (ej. un anillo o un peso de letra propio de un juego). */
  className?: string;
}

/**
 * Se renderiza una vez por jugador en cada lista de sala/lobby/votación —
 * memoizado para que un re-render disparado por un broadcast `"state"` de
 * WS no relacionado (lo cual pasa en casi cada acción de un jugador en una
 * sala multijugador) no vuelva a renderizar cada avatar de la lista, solo
 * aquellos cuyas props realmente cambiaron.
 *
 * El div raíz es `inline-flex`, no `flex` a secas: `flex` es un box de
 * nivel bloque, así que cuando se usa solo (sin nombre al lado, ej. un
 * header de diálogo centrado) ignora el `text-align: center` del padre y
 * queda pegado al borde izquierdo — el bug recurrente de "el avatar y el
 * nombre no quedan alineados". `inline-flex` sigue centrando las iniciales
 * puertas adentro y sigue comportándose igual como flex item dentro de
 * cualquier fila (avatar + texto), pero además respeta el `text-align`
 * heredado cuando es el único elemento centrado de un bloque.
 */
export const Avatar = memo(function Avatar({ name, size = 40, className }: AvatarProps) {
  const initials =
    name
      .trim()
      .split(" ")
      .map(w => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  const bg = avatarColor(name);
  return (
    <div
      className={clsx("inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white", className)}
      // Tamaño y color dependen de props (no son clases estáticas posibles).
      style={{ width: size, height: size, background: bg, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
});
