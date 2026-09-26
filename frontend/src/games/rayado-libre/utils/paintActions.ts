import type { DrawAction, StrokeAction } from "@juntada/rayado-libre-scoring";
import { CANVAS_HEIGHT, CANVAS_WIDTH, PAPER_COLOR } from "./board";
import { floodFill, type Rgba } from "./floodFill";

// Cómo se pinta el historial de dibujo (`stroke`, `fill`, `clear`) sobre el
// contexto 2D del tablero. Sin React: lo usa el pintor de Canvas.tsx.

/**
 * Dibuja un único trazo (`StrokeAction`) sobre el contexto dado, uniendo sus
 * puntos con líneas rectas.
 */
function drawStrokeAction(ctx: CanvasRenderingContext2D, action: StrokeAction): void {
  if (action.points.length === 0) return;
  ctx.strokeStyle = action.color;
  ctx.lineWidth = action.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(action.points[0][0], action.points[0][1]);
  for (let i = 1; i < action.points.length; i++) ctx.lineTo(action.points[i][0], action.points[i][1]);
  if (action.points.length === 1) ctx.lineTo(action.points[0][0] + 0.1, action.points[0][1] + 0.1); // a single tap still shows a dot
  ctx.stroke();
}

/**
 * Pinta un único segmento de línea directamente, sin pasar por el historial
 * de `strokes` — usado para el pintado local optimista de quien dibuja, que
 * no puede esperar a que el punto vuelva confirmado por el servidor para
 * aparecer en pantalla.
 */
export function drawLiveSegment(
  ctx: CanvasRenderingContext2D,
  from: [number, number],
  to: [number, number],
  color: string,
  size: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(to[0], to[1]);
  ctx.stroke();
}

/**
 * Resuelve cualquier color válido de CSS a sus componentes RGBA concretos,
 * usando un canvas de 1x1 descartable como intérprete de color. Cacheado:
 * al repintar el historial se resuelven los mismos pocos colores una y otra vez.
 */
const rgbaCache = new Map<string, Rgba>();
export function colorToRgba(color: string): Rgba {
  const cached = rgbaCache.get(color);
  if (cached) return cached;
  const c = document.createElement("canvas").getContext("2d");
  if (!c) return [0, 0, 0, 255];
  c.fillStyle = color;
  c.fillRect(0, 0, 1, 1);
  const d = c.getImageData(0, 0, 1, 1).data;
  const rgba: Rgba = [d[0], d[1], d[2], d[3]];
  rgbaCache.set(color, rgba);
  return rgba;
}

/**
 * Balde sobre los píxeles reales ya pintados en `ctx` en el momento de la
 * llamada — no sobre un modelo aparte — para que, durante el repintado del
 * historial, el relleno se propague únicamente dentro de lo que ya estaba
 * dibujado en ese punto de la secuencia, igual que ocurrió en vivo para
 * quien dibujó.
 */
function fillAt(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  const image = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  if (floodFill(image.data, CANVAS_WIDTH, CANVAS_HEIGHT, x, y, colorToRgba(color))) ctx.putImageData(image, 0, 0);
}

/** Hoja en blanco: el papel entero. */
export function paintPaper(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PAPER_COLOR;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

/**
 * Interpreta y pinta una única acción del historial de dibujo. Único punto
 * que conoce esta correspondencia acción → efecto visual.
 */
function paintAction(ctx: CanvasRenderingContext2D, action: DrawAction): void {
  if (action.type === "stroke") drawStrokeAction(ctx, action);
  else if (action.type === "fill") fillAt(ctx, action.x, action.y, action.color);
  else paintPaper(ctx);
}

/**
 * Compara dos {@link DrawAction} por valor — sin depender de identidad de
 * objeto, que no sobrevive un viaje por WebSocket: cada mensaje llega
 * deserializado con `JSON.parse`, que crea objetos nuevos aunque el
 * contenido sea igual.
 */
export function actionsEqual(a: DrawAction, b: DrawAction): boolean {
  if (a === b) return true;
  if (a.type !== b.type) return false;
  if (a.type === "stroke" && b.type === "stroke") {
    if (a.color !== b.color || a.size !== b.size || a.strokeId !== b.strokeId || a.points.length !== b.points.length) return false;
    for (let i = 0; i < a.points.length; i++) {
      if (a.points[i][0] !== b.points[i][0] || a.points[i][1] !== b.points[i][1]) return false;
    }
    return true;
  }
  if (a.type === "fill" && b.type === "fill") return a.x === b.x && a.y === b.y && a.color === b.color;
  return a.type === "clear"; // ambos son "clear" acá (mismo `type`, sin más campos que comparar)
}

/**
 * `next` es `prev` más acciones al final (el camino común: cada flush de red
 * agrega un chunk) — entonces alcanza con pintar solo lo nuevo.
 */
export function isHistoryExtension(prev: readonly DrawAction[], next: readonly DrawAction[]): boolean {
  return next.length >= prev.length && prev.every((action, i) => actionsEqual(action, next[i]));
}

/**
 * Pinta sobre `ctx` la diferencia entre el historial ya pintado (`prev`) y
 * el nuevo (`next`).
 *
 * `strokes` normalmente solo crece por el final (cada flush de red agrega
 * un chunk más), así que el camino común es agregar solo las acciones
 * nuevas sobre lo ya dibujado. Se repinta todo desde cero cuando `next` no
 * es una extensión simple de `prev` — al deshacer (saca acciones del final),
 * al alcanzar el tope `MAX_STROKES` del backend (saca del principio), al
 * borrar o al empezar una ronda nueva con historial propio.
 *
 * @param full Forzar el repintado completo (la primera vez, para que la hoja
 * arranque con papel opaco y el balde vea los mismos píxeles en todos lados).
 */
export function paintHistory(ctx: CanvasRenderingContext2D, prev: readonly DrawAction[], next: readonly DrawAction[], full = false): void {
  const isExtension = !full && isHistoryExtension(prev, next);
  if (!isExtension) {
    paintPaper(ctx);
    for (const action of next) paintAction(ctx, action);
  } else {
    for (let i = prev.length; i < next.length; i++) paintAction(ctx, next[i]);
  }
}
