import { useEffect, useRef } from "react";
import type { StrokeAction, FillAction, ClearAction, DrawAction } from "@juntada/rayado-libre-scoring";

// ─── Drawing board ───────────────────────────────────────────────────────────
// A "tonto"/presentation component shared by LocalGame (shared-screen mode)
// and RoundView (online mode): it owns pixel-level canvas rendering and
// pointer capture, but knows nothing about turns, timers, or scoring — the
// parent decides what's interactive and what a finished stroke/fill means.
//
// Every client (drawer and viewers alike) renders the exact same fixed
// internal resolution, scaled to fit via CSS — so points are stored in that
// one shared coordinate space and never need per-device normalization.
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

// Re-exported from the shared package (not redeclared here) so both this
// component and the engine agree on exactly one shape for a turn's drawing
// history — see popLastDrawUnit, used for "undo" on both ends.
export type { StrokeAction, FillAction, ClearAction, DrawAction };

export type Tool = { mode: "draw" | "erase" | "fill"; color: string; size: number };

interface CanvasProps {
  strokes: DrawAction[];
  interactive: boolean;
  tool?: Tool;
  // Fired repeatedly while a stroke is being drawn (roughly every 120ms) with
  // just the new points since the last flush, plus one final call on pointer
  // up — never the whole stroke at once, so the network payload per message
  // stays small and drawing streams to viewers as it happens rather than
  // arriving in one lump when the drawer lifts their finger. `strokeId` is
  // the same number for every chunk of one continuous gesture (see
  // popLastDrawUnit), so "undo" can remove a whole stroke, not just its
  // last fragment.
  onStrokeChunk?: (points: [number, number][], color: string, size: number, strokeId: number) => void;
  onFillAt?: (x: number, y: number, color: string) => void;
}

const ERASE_COLOR = "#ffffff";
const FLUSH_INTERVAL_MS = 120;

// Returns null if the canvas element is momentarily laid out at zero size
// (e.g. mid phase-transition, or a layout pass that hasn't settled yet) —
// dividing by a zero width/height would otherwise produce NaN points that
// the server's schema silently rejects, dropping the stroke with no
// feedback to the drawer.
function toCanvasCoords(canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number] | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const x = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH;
  const y = ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
  return [x, y];
}

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

// Classic 4-directional flood fill over the canvas's actual current pixels —
// run inline during replay (see redraw below) so a fill correctly only
// spreads within whatever's already been drawn at that point in the action
// history, exactly like it would live for whoever's actually drawing.
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

  const matches = (i: number) => data[i] === target[0] && data[i + 1] === target[1] && data[i + 2] === target[2] && data[i + 3] === target[3];
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

function hexToRgba(color: string): [number, number, number, number] {
  const c = document.createElement("canvas").getContext("2d") as CanvasRenderingContext2D;
  c.fillStyle = color;
  c.fillRect(0, 0, 1, 1);
  return Array.from(c.getImageData(0, 0, 1, 1).data) as [number, number, number, number];
}

export function Canvas({ strokes, interactive, tool, onStrokeChunk, onFillAt }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const pendingPointsRef = useRef<[number, number][]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Bumped once per gesture (on pointer down) — every chunk flushed during
  // that same gesture shares this id, so the parent's "undo" can group them.
  const strokeIdRef = useRef(0);

  // Full replay from scratch on every strokes change — simple and correct
  // (a fill's spread depends on everything drawn before it), and cheap
  // enough at the scale a single 99s turn's stroke history ever reaches.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    for (const action of strokes) {
      if (action.type === "stroke") drawStrokeAction(ctx, action);
      else if (action.type === "fill") floodFill(ctx, action.x, action.y, action.color);
      else if (action.type === "clear") ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }, [strokes]);

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
