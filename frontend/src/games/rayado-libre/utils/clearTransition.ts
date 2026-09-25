import { popLastDrawUnit, type DrawAction } from "@juntada/rayado-libre-scoring";

/**
 * Si la hoja pasó de tener dibujo a quedar vacía por un "borrar todo"
 * (para la sacudida de la hoja y el desvanecido del dibujo).
 *
 * El motor manda la hoja vacía tanto al borrar como al deshacer lo único que
 * había, así que ese caso solo cuenta como borrado si quien dibuja lo pidió
 * en este dispositivo (`clearRequested`). Si en cambio quedaba más de una
 * cosa, deshacer no pudo vaciarla de golpe: fue un borrado. El cambio de
 * palabra (que también vacía la hoja) lo descarta quien llama.
 *
 * @param prev Historial anterior.
 * @param next Historial nuevo.
 * @param clearRequested Quien dibuja tocó "¿Borrar?" y el borrado todavía no se vio.
 */
export function isClearTransition(prev: readonly DrawAction[], next: readonly DrawAction[], clearRequested: boolean): boolean {
  if (prev.length === 0 || next.length > 0) return false;
  return clearRequested || popLastDrawUnit(prev).length > 0;
}
