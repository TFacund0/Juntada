import { useEffect, useRef } from "react";
import type { StrokeAction, FillAction, ClearAction, DrawAction } from "@juntada/rayado-libre-scoring";

/**
 * Ancho interno fijo del tablero, en píxeles del espacio de coordenadas
 * compartido (no de pantalla).
 *
 * Todos los clientes (quien dibuja y quienes observan) renderizan esta misma
 * resolución interna y la escalan por CSS a su propio tamaño — así los puntos
 * de un trazo se guardan y transmiten en un único sistema de coordenadas y no
 * requieren normalización por dispositivo.
 */
export const CANVAS_WIDTH = 800;

/** Alto interno fijo del tablero, en píxeles del espacio de coordenadas compartido. Ver {@link CANVAS_WIDTH}. */
export const CANVAS_HEIGHT = 600;

// Re-exported from the shared package (not redeclared here) so both this
// component and the engine agree on exactly one shape for a turn's drawing
// history — see popLastDrawUnit, used for "undo" on both ends.
export type { StrokeAction, FillAction, ClearAction, DrawAction };

export type Tool = { mode: "draw" | "erase" | "fill"; color: string; size: number };

interface CanvasProps {
  /** Historial completo de acciones de dibujo de la ronda, en orden. Se repinta (total o incrementalmente) cada vez que cambia. */
  strokes: DrawAction[];
  /** Si `false`, el tablero solo muestra el historial recibido y no captura eventos de puntero (rol de espectador). */
  interactive: boolean;
  /** Herramienta activa (color, grosor, modo). Requerido para poder dibujar o rellenar; sin `tool` los handlers de puntero no hacen nada. */
  tool?: Tool;
  /**
   * Se dispara repetidamente mientras se dibuja un trazo (cada
   * {@link FLUSH_INTERVAL_MS} aprox.), con solo los puntos nuevos desde el
   * último envío, más una llamada final al soltar el puntero — nunca el
   * trazo completo de una — para que cada mensaje de red sea liviano y el
   * dibujo se transmita a quienes observan a medida que ocurre, en vez de
   * llegar todo junto cuando quien dibuja levanta el dedo.
   *
   * @param points Puntos nuevos acumulados desde el último flush, en coordenadas del tablero.
   * @param color Color efectivo del trazo (ya resuelto si `tool.mode === "erase"`).
   * @param size Grosor de línea.
   * @param strokeId Identificador del gesto: igual para todos los chunks de un mismo trazo continuo, para que "deshacer" pueda quitar el trazo entero y no solo su último fragmento.
   */
  onStrokeChunk?: (points: [number, number][], color: string, size: number, strokeId: number) => void;
  /**
   * Se dispara al tocar el tablero con la herramienta de relleno activa.
   *
   * @param x Coordenada X (espacio del tablero) donde se tocó.
   * @param y Coordenada Y (espacio del tablero) donde se tocó.
   * @param color Color de relleno seleccionado.
   */
  onFillAt?: (x: number, y: number, color: string) => void;
}

const ERASE_COLOR = "#ffffff";
const FLUSH_INTERVAL_MS = 60;

/**
 * Convierte coordenadas de puntero en pantalla (`clientX`/`clientY`) al
 * espacio de coordenadas interno y fijo del tablero ({@link CANVAS_WIDTH} x
 * {@link CANVAS_HEIGHT}).
 *
 * @param canvas Elemento canvas sobre el que se está dibujando.
 * @param clientX Coordenada X del evento de puntero, relativa al viewport.
 * @param clientY Coordenada Y del evento de puntero, relativa al viewport.
 * @returns El punto `[x, y]` en coordenadas del tablero, o `null` si el
 * canvas está momentáneamente medido a tamaño cero (por ejemplo, en medio de
 * una transición de fase o antes de que el layout se estabilice) — dividir
 * por un ancho/alto cero produciría puntos `NaN` que el schema del servidor
 * rechazaría en silencio, descartando el trazo sin avisarle a quien dibuja.
 */
function toCanvasCoords(canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number] | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const x = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH;
  const y = ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
  return [x, y];
}

/**
 * Dibuja un único trazo (`StrokeAction`) sobre el contexto dado, uniendo sus
 * puntos con líneas rectas.
 *
 * @param ctx Contexto 2D del canvas destino.
 * @param action Trazo a dibujar, con su color, grosor y lista de puntos.
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
 * Rellena por inundación (flood fill), en 4 direcciones, la región de
 * píxeles contigua y del mismo color que `(startX, startY)`.
 *
 * Se ejecuta sobre los píxeles reales ya pintados en `ctx` en el momento de
 * la llamada — no sobre un modelo aparte — para que, durante el repintado
 * del historial, el relleno se propague únicamente dentro de lo que ya
 * estaba dibujado en ese punto de la secuencia, igual que ocurrió en vivo
 * para quien dibujó.
 *
 * @param ctx Contexto 2D del canvas destino.
 * @param startX Coordenada X (en el espacio del tablero) donde se hizo clic.
 * @param startY Coordenada Y (en el espacio del tablero) donde se hizo clic.
 * @param fillColor Color de relleno, en cualquier formato aceptado por `CanvasRenderingContext2D.fillStyle`.
 */
function floodFill(ctx: CanvasRenderingContext2D, startX: number, startY: number, fillColor: string): void {
  const w = CANVAS_WIDTH;
  const h = CANVAS_HEIGHT;
  const sx = Math.round(startX);
  const sy = Math.round(startY);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const idx = (x: number, y: number) => (y * w + x) * 4;

  const target = data.slice(idx(sx, sy), idx(sx, sy) + 4);
  const fill = hexToRgba(fillColor);
  if (target[0] === fill[0] && target[1] === fill[1] && target[2] === fill[2] && target[3] === fill[3]) return;

  const matches = (i: number) =>
    data[i] === target[0] && data[i + 1] === target[1] && data[i + 2] === target[2] && data[i + 3] === target[3];
  const setPixel = (i: number) => {
    data[i] = fill[0];
    data[i + 1] = fill[1];
    data[i + 2] = fill[2];
    data[i + 3] = fill[3];
  };

  const stack: [number, number][] = [[sx, sy]];
  // Bounds the amount of work a single fill can do — a legitimately closed
  // shape on an 800x600 board never gets close to this; it only protects
  // against an accidentally-open shape flooding the entire board pixel by
  // pixel on every redraw.
  const MAX_PIXELS = w * h;
  let visited = 0;
  while (stack.length > 0 && visited < MAX_PIXELS) {
    const [x, y] = stack.pop() as [number, number];
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const i = idx(x, y);
    if (!matches(i)) continue;
    setPixel(i);
    visited++;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Resuelve cualquier color válido de CSS a sus componentes RGBA concretos,
 * usando un canvas de 1x1 descartable como intérprete de color.
 *
 * @param color Color en cualquier formato aceptado por `CanvasRenderingContext2D.fillStyle` (hex, nombre, rgb(), etc.).
 * @returns Tupla `[r, g, b, a]` con valores de 0 a 255.
 */
function hexToRgba(color: string): [number, number, number, number] {
  const c = document.createElement("canvas").getContext("2d") as CanvasRenderingContext2D;
  c.fillStyle = color;
  c.fillRect(0, 0, 1, 1);
  return Array.from(c.getImageData(0, 0, 1, 1).data) as [number, number, number, number];
}

/**
 * Interpreta y pinta una única acción del historial de dibujo (`stroke`,
 * `fill` o `clear`) sobre el contexto dado.
 *
 * Único punto que conoce esta correspondencia acción → efecto visual, para
 * no repetir el mismo switch en el repintado completo y en el incremental
 * (ver {@link Canvas}).
 *
 * @param ctx Contexto 2D del canvas destino.
 * @param action Acción a interpretar y pintar.
 */
function paintAction(ctx: CanvasRenderingContext2D, action: DrawAction): void {
  if (action.type === "stroke") drawStrokeAction(ctx, action);
  else if (action.type === "fill") floodFill(ctx, action.x, action.y, action.color);
  else if (action.type === "clear") ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

/**
 * Tablero de dibujo: componente de presentación ("tonto") compartido por
 * `LocalGame` (modo pantalla compartida) y `RoundView` (modo online).
 *
 * Es responsable únicamente del renderizado a nivel de píxel y de la captura
 * de puntero; no conoce turnos, temporizadores ni puntaje — el componente
 * padre decide qué es interactivo y qué significa un trazo o relleno
 * terminado (ver {@link CanvasProps}).
 *
 * Rendimiento: en cada actualización de `strokes`, el pintado ocurre en el
 * siguiente `requestAnimationFrame` y, siempre que sea posible, solo agrega
 * al canvas las acciones nuevas en vez de repetir todo el historial — ver
 * {@link paintIncremental}.
 */
export function Canvas({ strokes, interactive, tool, onStrokeChunk, onFillAt }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const pendingPointsRef = useRef<[number, number][]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Id del gesto de trazo actual. Se incrementa en cada `pointerdown`; todos los chunks de ese mismo gesto lo comparten (ver {@link CanvasProps.onStrokeChunk}). */
  const strokeIdRef = useRef(0);

  /** Último historial (`strokes`) efectivamente pintado en el canvas — referencia de comparación para el pintado incremental. */
  const paintedStrokesRef = useRef<DrawAction[]>([]);
  /** Historial más reciente recibido, pendiente de pintarse en el próximo frame. `null` cuando no hay pintado agendado. */
  const pendingPaintStrokesRef = useRef<DrawAction[] | null>(null);
  /** Id del `requestAnimationFrame` agendado, o `null` si no hay ninguno en curso. */
  const rafIdRef = useRef<number | null>(null);

  /**
   * Pinta sobre `ctx` la diferencia entre el historial ya pintado (`prev`) y
   * el nuevo (`toPaint`).
   *
   * `strokes` normalmente solo crece por el final (cada flush de red agrega
   * un chunk más), así que el camino común es agregar solo las acciones
   * nuevas sobre lo ya dibujado, sin repetir el historial completo en cada
   * actualización. Se hace una excepción y se repinta todo desde cero cuando
   * `toPaint` no es una extensión simple de `prev` — por ejemplo al deshacer
   * (saca acciones del final), al alcanzar el tope `MAX_STROKES` del backend
   * (saca del principio) o al empezar una ronda nueva con historial propio.
   *
   * @param ctx Contexto 2D del canvas destino.
   * @param prev Historial previamente pintado.
   * @param toPaint Historial actual a reflejar en pantalla.
   */
  const paintIncremental = (ctx: CanvasRenderingContext2D, prev: DrawAction[], toPaint: DrawAction[]) => {
    const isIncrementalExtension = toPaint.length >= prev.length && prev.every((action, i) => action === toPaint[i]);
    if (!isIncrementalExtension) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      for (const action of toPaint) paintAction(ctx, action);
    } else {
      for (let i = prev.length; i < toPaint.length; i++) paintAction(ctx, toPaint[i]);
    }
  };

  // Si llegan varias actualizaciones de `strokes` en el mismo tick (ráfaga de
  // mensajes por WebSocket), coalescemos: solo se pinta la última, en el
  // próximo frame, en vez de una vez por actualización.

  useEffect(() => {
    pendingPaintStrokesRef.current = strokes;
    if (rafIdRef.current !== null) return;

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      const toPaint = pendingPaintStrokesRef.current;
      pendingPaintStrokesRef.current = null;
      if (!toPaint) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;

      paintIncremental(ctx, paintedStrokesRef.current, toPaint);
      paintedStrokesRef.current = toPaint;
    });
  }, [strokes]);

  useEffect(
    () => () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    },
    [],
  );

  useEffect(
    () => () => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    },
    [],
  );

  const flush = () => {
    if (pendingPointsRef.current.length === 0 || !tool) return;
    const color = tool.mode === "erase" ? ERASE_COLOR : tool.color;
    onStrokeChunk?.(pendingPointsRef.current, color, tool.size, strokeIdRef.current);
    // Keep the last point as the first of the next chunk so consecutive
    // network chunks connect visually instead of leaving a gap.
    pendingPointsRef.current = pendingPointsRef.current.slice(-1);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive || !tool) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const coords = toCanvasCoords(canvas, e.clientX, e.clientY);
    if (!coords) return;
    const [x, y] = coords;

    if (tool.mode === "fill") {
      onFillAt?.(x, y, tool.color);
      return;
    }

    drawingRef.current = true;
    strokeIdRef.current += 1;
    pendingPointsRef.current = [[x, y]];
    flushTimerRef.current = setInterval(flush, FLUSH_INTERVAL_MS);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const coords = toCanvasCoords(canvas, e.clientX, e.clientY);
    if (!coords) return;
    pendingPointsRef.current.push(coords);
  };

  const endStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    flush();
    pendingPointsRef.current = [];
  };

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endStroke}
      onPointerLeave={endStroke}
      style={{
        width: "100%",
        aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
        borderRadius: 12,
        border: "1px solid rgba(127,119,221,0.25)",
        touchAction: "none",
        cursor: interactive ? (tool?.mode === "fill" ? "crosshair" : "crosshair") : "default",
        display: "block",
      }}
    />
  );
}
