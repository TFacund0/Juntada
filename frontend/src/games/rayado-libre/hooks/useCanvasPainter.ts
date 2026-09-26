import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { DrawAction } from "@juntada/rayado-libre-scoring";
import { usePrefersReducedMotion } from "../../../components/game-kit/hooks/usePrefersReducedMotion";
import { useAnimationGate } from "../../../components/game-kit/hooks/useAnimationGate";
import { paintHistory } from "../utils/paintActions";

// Al borrar todo, el dibujo se desvanece antes de que la hoja quede vacía
// (`cv.animate` de la referencia).
const CLEAR_FADE: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];
const CLEAR_FADE_MS = 260;

/**
 * Pinta el historial `strokes` en el canvas.
 *
 * Rendimiento: el pintado ocurre en el siguiente `requestAnimationFrame` y,
 * siempre que sea posible, solo agrega al canvas las acciones nuevas en vez
 * de repetir todo el historial (ver `paintHistory`). Si llegan varias
 * actualizaciones en el mismo tick (ráfaga de mensajes por WebSocket), solo
 * se pinta la última.
 *
 * Borrado: cuando `clearFx` cambia junto con una hoja que se vacía, el
 * dibujo viejo se desvanece (260 ms) y recién ahí se pinta la hoja vacía —
 * lo que llegue mientras tanto se pinta al terminar. Sin animación con
 * movimiento reducido o si la pantalla recién vuelve de otra app.
 *
 * @returns `getCtx`, el contexto 2D cacheado (para el pintado optimista de quien dibuja).
 */
export function useCanvasPainter(canvasRef: RefObject<HTMLCanvasElement | null>, strokes: DrawAction[], clearFx: number) {
  // El contexto no cambia mientras el <canvas> vive — cachearlo evita pedirlo
  // de nuevo en cada `pointermove` (decenas por segundo mientras se dibuja).
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const getCtx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = canvasRef.current?.getContext("2d") ?? null;
    return ctxRef.current;
  }, [canvasRef]);

  /** Último historial efectivamente pintado — referencia del pintado incremental. `null` hasta el primer pintado. */
  const paintedRef = useRef<DrawAction[] | null>(null);
  /** Historial más reciente recibido, pendiente de pintarse. */
  const pendingRef = useRef<DrawAction[] | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const fadingRef = useRef(false);
  const clearFxRef = useRef(clearFx);
  const fadedFxRef = useRef(clearFx);
  const reduced = usePrefersReducedMotion();
  const reducedRef = useRef(reduced);
  const canAnimate = useAnimationGate();

  const paintPending = useCallback(() => {
    rafIdRef.current = null;
    const next = pendingRef.current;
    const ctx = getCtx();
    if (!next || !ctx || fadingRef.current) return;
    const painted = paintedRef.current;
    const canvas = canvasRef.current;
    // Un borrado nuevo se consume en el primer pintado después de él, haya o
    // no quedado vacía la hoja (si ya llegó otro trazo, no hay nada que desvanecer).
    const clearing = clearFxRef.current !== fadedFxRef.current && next.length === 0 && !!painted && painted.length > 0;
    fadedFxRef.current = clearFxRef.current;
    if (clearing && canvas?.animate && !reducedRef.current && canAnimate()) {
      fadingRef.current = true;
      const fade = canvas.animate(CLEAR_FADE, { duration: CLEAR_FADE_MS, fill: "forwards" });
      const done = () => {
        fadingRef.current = false;
        paintPending();
        fade.cancel();
      };
      fade.finished.then(done, done);
      return;
    }
    pendingRef.current = null;
    // La primera vez, repintado completo: la hoja arranca con papel opaco
    // (no transparente), así el balde ve los mismos píxeles en todos lados.
    paintHistory(ctx, painted ?? [], next, painted === null);
    paintedRef.current = next;
  }, [canvasRef, getCtx, canAnimate]);

  // Antes que el efecto de `strokes`: el pintado tiene que ver el `clearFx` del mismo render.
  useEffect(() => {
    clearFxRef.current = clearFx;
    reducedRef.current = reduced;
  }, [clearFx, reduced]);

  useEffect(() => {
    pendingRef.current = strokes;
    if (rafIdRef.current !== null || fadingRef.current) return;
    rafIdRef.current = requestAnimationFrame(paintPending);
  }, [strokes, paintPending]);

  useEffect(
    () => () => {
      // Resetear a `null` (no solo cancelar) es necesario para que sobreviva
      // al doble efecto de StrictMode en dev: monta → corre este cleanup
      // simulando un desmonte → vuelve a montar. Sin el reseteo, ese cleanup
      // cancela el primer rAF programado pero deja `rafIdRef.current`
      // apuntando a un id ya cancelado (no `null`), y el guard de arriba
      // ("ya hay uno programado") bloquea cualquier pintado para siempre.
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    },
    [],
  );

  return getCtx;
}
