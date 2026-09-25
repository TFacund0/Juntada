import { useState } from "react";
import type { DrawAction } from "@juntada/rayado-libre-scoring";
import { isClearTransition } from "../utils/clearTransition";

/**
 * Cuenta los "borrar todo" que se vieron en la hoja (cambia en el mismo
 * render en que la hoja queda vacía), para la sacudida del papel y el
 * desvanecido del dibujo — tanto en el dispositivo de quien borró como en
 * el de quienes miran.
 *
 * @param strokes Historial de dibujo actual.
 * @param resetKey Cambia cuando la hoja se vacía por otra cosa (pedir otra
 * palabra): esa transición no cuenta como borrado.
 * @param clearRequest Contador de "¿Borrar?" confirmados en este dispositivo
 * (quien dibuja): un pedido pendiente hace que el próximo vaciado cuente
 * aunque deshacer también hubiera podido producirlo.
 */
export function useClearFx(strokes: DrawAction[], resetKey: string, clearRequest: number): number {
  const [seen, setSeen] = useState({ strokes, resetKey, handledRequest: clearRequest });
  const [fx, setFx] = useState(0);
  // Estado derivado del render anterior (patrón "ajustar estado al cambiar
  // una prop" de React): así `fx` cambia en el mismo render que `strokes`.
  if (seen.strokes !== strokes || seen.resetKey !== resetKey) {
    const requested = clearRequest !== seen.handledRequest;
    const cleared = seen.resetKey === resetKey && isClearTransition(seen.strokes, strokes, requested);
    setSeen({ strokes, resetKey, handledRequest: cleared ? clearRequest : seen.handledRequest });
    if (cleared) setFx(n => n + 1);
  }
  return fx;
}
