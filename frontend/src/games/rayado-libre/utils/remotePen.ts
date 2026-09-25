import type { DrawAction } from "@juntada/rayado-libre-scoring";

export interface PenTip {
  x: number;
  y: number;
  color: string;
}

/**
 * Cuánta "tinta" hay en el historial: puntos de trazo más uno por cada
 * relleno o borrado. Crece mientras llegan trazos y baja al deshacer o
 * borrar — así se distingue "está dibujando" de un broadcast que trae el
 * mismo dibujo otra vez (llega uno por cada mensaje del chat, por ejemplo).
 */
export function inkAmount(strokes: readonly DrawAction[]): number {
  let total = 0;
  for (const a of strokes) total += a.type === "stroke" ? a.points.length : 1;
  return total;
}

/** Punta del último trazo (último punto y su color), o `null` si lo último no fue un trazo. */
export function latestPenTip(strokes: readonly DrawAction[]): PenTip | null {
  const last = strokes[strokes.length - 1];
  if (!last || last.type !== "stroke" || last.points.length === 0) return null;
  const [x, y] = last.points[last.points.length - 1];
  return { x, y, color: last.color };
}

/**
 * Qué hacer con el marcador remoto cuando llega un historial nuevo:
 * - `move`: creció con un trazo → el marcador va a la punta;
 * - `hide`: se deshizo, se borró, o lo nuevo fue un relleno;
 * - `none`: el mismo dibujo de antes (no cambia nada).
 */
export type PenChange = { kind: "none" } | { kind: "hide" } | { kind: "move"; tip: PenTip };

export function penChange(prevInk: number, strokes: readonly DrawAction[]): PenChange {
  const ink = inkAmount(strokes);
  if (ink === prevInk) return { kind: "none" };
  const tip = ink > prevInk ? latestPenTip(strokes) : null;
  return tip ? { kind: "move", tip } : { kind: "hide" };
}
