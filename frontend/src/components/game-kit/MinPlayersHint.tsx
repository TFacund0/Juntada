import clsx from "clsx";
import { T } from "../../theme/styles/classes";

/**
 * El aviso de "Necesitás mínimo N jugadores" que se muestra debajo de un
 * botón de arranque deshabilitado — mismo texto/estilo copiado a mano en la
 * mayoría de las pantallas de setup de cada juego. No renderiza nada una
 * vez cumplido el mínimo, así quien lo usa puede ponerlo incondicionalmente
 * en vez de tener que chequearlo por su cuenta.
 */
export function MinPlayersHint({ count, min }: { count: number; min: number }) {
  if (count >= min) return null;
  return <p className={clsx(T.muted, "text-center mt-2")}>Necesitás mínimo {min} jugadores</p>;
}
