import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { StrokeAction, FillAction, ClearAction, DrawAction } from "@juntada/rayado-libre-scoring";
import { CANVAS_HEIGHT, CANVAS_WIDTH, PAPER_COLOR } from "../utils/board";
import { strokeWidth, type Tool } from "../utils/palette";
import { cursorFor } from "../utils/cursorSvg";
import { isAlreadyFilled } from "../utils/floodFill";
import { colorToRgba, drawLiveSegment } from "../utils/paintActions";
import { useCanvasPainter } from "../hooks/useCanvasPainter";
import type { ScribbleSound } from "../hooks/useScribbleSound";

export { CANVAS_WIDTH, CANVAS_HEIGHT, PAPER_COLOR };

// Re-exported from the shared package (not redeclared here) so both this
// component and the engine agree on exactly one shape for a turn's drawing
// history — see popLastDrawUnit, used for "undo" on both ends.
export type { StrokeAction, FillAction, ClearAction, DrawAction, Tool };

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
   * @param color Color efectivo del trazo (el del papel si `tool.mode === "erase"`).
   * @param size Grosor de línea efectivo (la goma es 2,5 veces más ancha, ver `strokeWidth`).
   * @param strokeId Identificador del gesto: igual para todos los chunks de un mismo trazo continuo, para que "deshacer" pueda quitar el trazo entero y no solo su último fragmento.
   */
  onStrokeChunk?: (points: [number, number][], color: string, size: number, strokeId: number) => void;
  /**
   * Se dispara al tocar el tablero con el balde, solo si el relleno va a
   * cambiar algo (tocar una zona que ya es de ese color no hace nada).
   *
   * @param x Coordenada X (espacio del tablero) donde se tocó.
   * @param y Coordenada Y (espacio del tablero) donde se tocó.
   * @param color Color de relleno seleccionado.
   */
  onFillAt?: (x: number, y: number, color: string) => void;
  /** Cambia cuando la hoja se vacía por un "borrar todo": el dibujo se desvanece en vez de desaparecer de golpe (ver useCanvasPainter). */
  clearFx?: number;
  /** Garabato de marcador mientras se dibuja (solo quien dibuja). */
  scribble?: ScribbleSound;
  /** Punta del lápiz mientras se dibuja con él (no con goma ni balde), o `null` al levantarlo — para el marcador propio (ver OwnPen). */
  onPenMove?: (point: [number, number] | null) => void;
}

const FLUSH_INTERVAL_MS = 60;

/**
 * Convierte coordenadas de puntero en pantalla (`clientX`/`clientY`) al
 * espacio de coordenadas interno y fijo del tablero ({@link CANVAS_WIDTH} x
 * {@link CANVAS_HEIGHT}).
 *
 * @returns El punto `[x, y]` en coordenadas del tablero (recortado a sus
 * límites — ver nota abajo), o `null` si el canvas está momentáneamente
 * medido a tamaño cero (por ejemplo, en medio de una transición de fase o
 * antes de que el layout se estabilice) — dividir por un ancho/alto cero
 * produciría puntos `NaN` que el schema del servidor rechazaría en
 * silencio, descartando el trazo sin avisarle a quien dibuja.
 */
function toCanvasCoords(canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number] | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const x = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH;
  const y = ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
  // `setPointerCapture` (ver handlePointerDown) hace que el puntero siga
  // mandando `pointermove` aunque salga del canvas, y por spec suprime
  // `pointerleave` mientras dura la captura — sin este recorte, arrastrar el
  // cursor fuera del tablero mid-trazo generaba puntos negativos o mayores a
  // CANVAS_WIDTH/HEIGHT, que se guardaban igual (el schema del servidor solo
  // valida que sean números finitos, no que estén dentro del tablero) y se
  // veían como el trazo "saltando" hacia afuera y volviendo de golpe.
  return [Math.min(Math.max(x, 0), CANVAS_WIDTH), Math.min(Math.max(y, 0), CANVAS_HEIGHT)];
}

/** Ancho del canvas en pantalla, para escalar el cursor al tablero real. */
function useRenderedWidth(canvasRef: React.RefObject<HTMLCanvasElement | null>, enabled: boolean): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) return;
    setWidth(canvas.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(canvas.getBoundingClientRect().width));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasRef, enabled]);
  return width;
}

/**
 * Tablero de dibujo: componente de presentación ("tonto") compartido por
 * `LocalGame` (modo pantalla compartida) y `RoundView` (modo online).
 *
 * Es responsable únicamente del renderizado a nivel de píxel y de la captura
 * de puntero; no conoce turnos, temporizadores ni puntaje — el componente
 * padre decide qué es interactivo y qué significa un trazo o relleno
 * terminado (ver {@link CanvasProps}). El pintado del historial vive en
 * useCanvasPainter.
 */
export function Canvas({ strokes, interactive, tool, onStrokeChunk, onFillAt, clearFx = 0, scribble, onPenMove }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const getCtx = useCanvasPainter(canvasRef, strokes, clearFx);
  const canDraw = interactive && !!tool;
  const boardWidth = useRenderedWidth(canvasRef, canDraw);
  const drawingRef = useRef(false);
  const pendingPointsRef = useRef<[number, number][]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Id del gesto de trazo actual. Se incrementa en cada `pointerdown`; todos los chunks de ese mismo gesto lo comparten (ver {@link CanvasProps.onStrokeChunk}). */
  const strokeIdRef = useRef(0);
  /** Último punto y momento usados para medir la velocidad del trazo (sonido). */
  const speedRef = useRef<{ point: [number, number]; t: number } | null>(null);
  const scribbleRef = useRef(scribble);
  useEffect(() => {
    scribbleRef.current = scribble;
  });

  useEffect(
    () => () => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      scribbleRef.current?.stop();
    },
    [],
  );

  // Si deja de ser interactivo (por ejemplo, cambia la fase a reveal mientras
  // se dibujaba), se corta de inmediato cualquier trazo en progreso.
  useEffect(() => {
    if (!interactive || !tool) {
      if (drawingRef.current) {
        drawingRef.current = false;
        if (flushTimerRef.current) {
          clearInterval(flushTimerRef.current);
          flushTimerRef.current = null;
        }
        pendingPointsRef.current = [];
        speedRef.current = null;
        scribbleRef.current?.stop();
        onPenMove?.(null);
      }
    }
  }, [interactive, tool, onPenMove]);

  const flush = () => {
    if (pendingPointsRef.current.length === 0 || !tool) return;
    const color = tool.mode === "erase" ? PAPER_COLOR : tool.color;
    onStrokeChunk?.(pendingPointsRef.current, color, strokeWidth(tool), strokeIdRef.current);
    // Keep the last point as the first of the next chunk so consecutive
    // network chunks connect visually instead of leaving a gap.
    pendingPointsRef.current = pendingPointsRef.current.slice(-1);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive || !tool) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const coords = toCanvasCoords(canvas, e.clientX, e.clientY);
    if (!coords) return;
    const [x, y] = coords;

    if (tool.mode === "fill") {
      // Tocar una zona que ya es de ese color no rellena nada: ni se manda ni suena.
      const px = getCtx()?.getImageData(Math.min(Math.floor(x), CANVAS_WIDTH - 1), Math.min(Math.floor(y), CANVAS_HEIGHT - 1), 1, 1).data;
      if (px && isAlreadyFilled([px[0], px[1], px[2], px[3]], colorToRgba(tool.color))) return;
      onFillAt?.(x, y, tool.color);
      return;
    }

    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    strokeIdRef.current += 1;
    pendingPointsRef.current = [[x, y]];
    flushTimerRef.current = setInterval(flush, FLUSH_INTERVAL_MS);
    speedRef.current = { point: [x, y], t: performance.now() };
    scribble?.start();
    if (tool.mode === "draw") onPenMove?.([x, y]);
  };

  // Pintado local optimista: quien dibuja ve cada segmento en el instante en
  // que mueve el puntero, en vez de esperar a que el chunk viaje al servidor
  // y vuelva confirmado por `strokes` (esa ida y vuelta es la que hacía sentir
  // el trazo "atrasado"). El repintado por `strokes` sigue pasando igual una
  // vez confirmado — redibuja el mismo segmento encima, inofensivo con los
  // colores opacos que usa esta paleta.
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !tool) return;
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const coords = toCanvasCoords(canvas, e.clientX, e.clientY);
    if (!coords) return;
    const prev = pendingPointsRef.current[pendingPointsRef.current.length - 1];
    if (prev) drawLiveSegment(ctx, prev, coords, tool.mode === "erase" ? PAPER_COLOR : tool.color, strokeWidth(tool));
    pendingPointsRef.current.push(coords);
    if (tool.mode === "draw") onPenMove?.(coords);

    // Velocidad para el garabato, con el mismo umbral de 2 px que la referencia.
    const last = speedRef.current;
    if (last) {
      const d = Math.hypot(coords[0] - last.point[0], coords[1] - last.point[1]);
      if (d >= 2) {
        const now = performance.now();
        scribble?.speed(d / Math.max(1, now - last.t));
        speedRef.current = { point: coords, t: now };
      }
    }
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
    speedRef.current = null;
    scribble?.stop();
    onPenMove?.(null);
  };

  return (
    <canvas
      role="img"
      aria-label="Tablero de dibujo"
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
      onPointerLeave={endStroke}
      // Cuadrado como CANVAS_WIDTH x CANVAS_HEIGHT. El fondo de papel va
      // también por CSS por si el primer pintado todavía no ocurrió.
      className={clsx("block aspect-square w-full touch-none bg-rl-paper", !canDraw && "cursor-default")}
      // Cursor en compu: círculo del tamaño y color reales del trazo (depende
      // de la herramienta y de lo que mide el tablero, ver cursorFor).
      style={canDraw && tool ? { cursor: cursorFor(tool, boardWidth) } : undefined}
    />
  );
}
