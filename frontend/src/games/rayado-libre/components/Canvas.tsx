import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
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
 * Pinta un único segmento de línea directamente, sin pasar por el historial
 * de `strokes` — usado para el pintado local optimista de quien dibuja (ver
 * {@link Canvas.handlePointerMove}), que no puede esperar a que el punto
 * vuelva confirmado por el servidor para aparecer en pantalla.
 *
 * @param ctx Contexto 2D del canvas destino.
 * @param from Punto de origen del segmento, en coordenadas del tablero.
 * @param to Punto de destino del segmento, en coordenadas del tablero.
 * @param color Color del trazo.
 * @param size Grosor de línea.
 */
function drawLiveSegment(ctx: CanvasRenderingContext2D, from: [number, number], to: [number, number], color: string, size: number): void {
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
 * Compara dos {@link DrawAction} por valor — usado por `paintIncremental`
 * (ver {@link Canvas}) para decidir si `strokes` sigue siendo una extensión
 * simple de lo ya pintado, sin depender de identidad de objeto (que no
 * sobrevive un viaje por WebSocket: cada mensaje llega deserializado con
 * `JSON.parse`, que crea objetos nuevos aunque el contenido sea igual).
 *
 * @param a Primera acción a comparar.
 * @param b Segunda acción a comparar.
 * @returns `true` si representan exactamente el mismo trazo, relleno o clear.
 */
function actionsEqual(a: DrawAction, b: DrawAction): boolean {
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
  else if (action.type === "clear") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
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
  // El contexto no cambia mientras el <canvas> vive — cachearlo evita pedirlo
  // de nuevo en cada `pointermove` (decenas por segundo mientras se dibuja),
  // el hot path más caliente de este componente.
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const getCtx = () => {
    if (!ctxRef.current) ctxRef.current = canvasRef.current?.getContext("2d") ?? null;
    return ctxRef.current;
  };
  const drawingRef = useRef(false);
  // Posición del puntero/dedo, en píxeles de PANTALLA relativos al canvas
  // (no en el espacio de coordenadas interno 800x600) — solo para dibujar el
  // indicador visual de "lápiz" (ver el overlay en el return), nunca se usa
  // para trazar. Da trazabilidad de dónde va a caer el trazo mientras se
  // dibuja, algo que el cursor nativo del sistema no muestra en touch (los
  // dedos no tienen cursor) y que en mouse tampoco reflejaba el color/grosor
  // real de la herramienta activa.
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; scale: number } | null>(null);
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
    // Comparación por valor, no por referencia: en el modo online `strokes`
    // llega serializado por WebSocket (JSON.parse en cada mensaje genera
    // objetos nuevos aunque el contenido no cambió), así que `===` daba
    // siempre `false` y forzaba el repintado completo (blanqueo + replay de
    // todo el historial) en cada chunk de red mientras se dibujaba — visible
    // como un parpadeo del trazo.
    const isIncrementalExtension = toPaint.length >= prev.length && prev.every((action, i) => actionsEqual(action, toPaint[i]));
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

      const ctx = getCtx();
      if (!ctx) return;

      paintIncremental(ctx, paintedStrokesRef.current, toPaint);
      paintedStrokesRef.current = toPaint;
    });
  }, [strokes]);

  useEffect(
    () => () => {
      // Resetear a `null` (no solo cancelar) es necesario para que sobreviva
      // al doble efecto de StrictMode en dev: monta → corre este cleanup
      // simulando un desmonte → vuelve a montar. Sin el reseteo, ese cleanup
      // cancela el primer rAF programado pero deja `rafIdRef.current`
      // apuntando a un id ya cancelado (no `null`), y el guard de arriba
      // ("ya hay uno programado") bloquea cualquier pintado para siempre —
      // los trazos se registraban pero nunca se veían en pantalla.
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
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

  // Pintado local optimista: quien dibuja ve cada segmento en el instante en
  // que mueve el puntero, en vez de esperar a que el chunk viaje al servidor
  // y vuelva confirmado por `strokes` (esa ida y vuelta es la que hacía sentir
  // el trazo "atrasado"). El repintado por `strokes` sigue pasando igual una
  // vez confirmado — redibuja el mismo segmento encima, inofensivo con los
  // colores opacos que usa esta paleta.
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (interactive && tool) {
      const rect = e.currentTarget.getBoundingClientRect();
      setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top, scale: rect.width / CANVAS_WIDTH });
    }
    if (!drawingRef.current || !tool) return;
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const coords = toCanvasCoords(canvas, e.clientX, e.clientY);
    if (!coords) return;
    const prev = pendingPointsRef.current[pendingPointsRef.current.length - 1];
    if (tool.mode !== "fill" && prev) {
      const color = tool.mode === "erase" ? ERASE_COLOR : tool.color;
      drawLiveSegment(ctx, prev, coords, color, tool.size);
    }
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

  // Separado de `endStroke` (que solo hace lo suyo si había un trazo en
  // curso) porque salir del canvas siempre debe ocultar el indicador, haya o
  // no un trazo activo en ese momento.
  const handlePointerLeave = () => {
    setCursorPos(null);
    endStroke();
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endStroke}
        onPointerLeave={handlePointerLeave}
        className={clsx(
          "block w-full touch-none rounded-xl border border-[rgba(127,119,221,0.25)] bg-white",
          // El indicador de abajo reemplaza al cursor nativo — mostrar los
          // dos a la vez se leía como dos punteros superpuestos. El canvas
          // arranca con píxeles transparentes hasta que llega la primera
          // acción "clear" del historial (ver paintAction) — sin `bg-white`
          // de base, el tablero deja ver el fondo oscuro del tema por detrás
          // y el trazo por defecto (casi negro) queda invisible encima.
          interactive && tool ? "cursor-none" : "cursor-default",
        )}
        style={{
          // No expresable como clase estática de Tailwind: depende de las
          // constantes CANVAS_WIDTH/CANVAS_HEIGHT de arriba, no de un valor
          // fijo — una clase arbitraria interpolada (`aspect-[${...}]`) no
          // la detectaría el compilador JIT de Tailwind al escanear el
          // código fuente (necesita ver el string literal completo).
          aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
        }}
      />
      {/* Indicador de "lápiz": un círculo del color/grosor real de la
          herramienta activa, centrado en la posición exacta del puntero o
          dedo — da trazabilidad de dónde va a caer el trazo mientras se
          dibuja, algo que ni el cursor nativo del sistema (inexistente en
          touch) ni un `cursor: crosshair` genérico mostraban. `pointer-
          events: none` para que nunca intercepte el propio evento que lo
          mueve. */}
      {cursorPos && tool && (
        <div
          style={{
            position: "absolute",
            left: cursorPos.x,
            top: cursorPos.y,
            width: Math.max(tool.size * cursorPos.scale, 6),
            height: Math.max(tool.size * cursorPos.scale, 6),
            marginLeft: -Math.max(tool.size * cursorPos.scale, 6) / 2,
            marginTop: -Math.max(tool.size * cursorPos.scale, 6) / 2,
            borderRadius: "50%",
            background: tool.mode === "erase" ? "transparent" : tool.color,
            border: "1.5px solid rgba(0,0,0,0.55)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.85)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
