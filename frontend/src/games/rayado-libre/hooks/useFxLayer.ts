import { useEffect, useMemo, useRef } from "react";
import { usePrefersReducedMotion } from "../../../components/game-kit/hooks/usePrefersReducedMotion";
import { confettiPieces, inkBlobs } from "../utils/fxParams";

/**
 * Efectos sueltos por encima de toda la pantalla (`inkSplash`, `floatPts`,
 * `bigFlash` y `confetti` de la referencia). Van en una capa fija propia
 * colgada de `document.body` — fuera del árbol que anima la transición de
 * pantalla, que con su `transform` atraparía cualquier `position: fixed` —,
 * inerte (sin eventos de puntero, oculta a lectores de pantalla: lo que
 * anuncia también queda escrito en el chat). Cada pieza se crea al vuelo,
 * se anima con Web Animations y se borra sola al terminar; sin Web
 * Animations (jsdom) no se crea nada.
 *
 * Con movimiento reducido: sin confeti ni manchas, el cartel aparece y se
 * va sin escalar, y los puntos se desvanecen en su lugar sin viajar.
 */
export interface FxLayer {
  /** Manchas de tinta en (x, y), en px de la ventana. `big`: 7 grandes del arcoíris. */
  inkSplash: (color: string, x: number, y: number, big?: boolean) => void;
  /** "+N" que sale de `from` y vuela hasta `to` (el reloj). */
  floatPoints: (text: string, from: DOMRect, to: DOMRect | null) => void;
  /** Cartel gigante girado ("¡Adivinaste!") con una línea debajo ("+60 puntos"). */
  bigFlash: (text: string, sub: string) => void;
  confetti: (count: number) => void;
}

const FLASH_HOLD_MS = 1300;
const FLASH_FADE_MS = 250;

function piece(layer: HTMLElement, className: string, style: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const el = document.createElement("div");
  el.className = className;
  Object.assign(el.style, style);
  layer.appendChild(el);
  return el;
}

// Se borra al terminar (o si se cancela al desmontar la capa).
function run(el: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions): void {
  const animation = el.animate(keyframes, options);
  const remove = () => el.remove();
  animation.onfinish = remove;
  animation.oncancel = remove;
}

export function useFxLayer(): FxLayer {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useEffect(() => {
    const layer = document.createElement("div");
    layer.setAttribute("aria-hidden", "true");
    layer.className = "pointer-events-none fixed inset-0 z-[var(--jt-z-fullscreen-flash,200)] overflow-hidden font-figtree";
    document.body.appendChild(layer);
    layerRef.current = layer;
    return () => {
      layerRef.current = null;
      // Lo que ya está en el aire termina aunque la pantalla se vaya: el
      // último acierto cierra el turno al instante y su "¡Adivinaste!" y el
      // confeti siguen sobre la revelación, como en la referencia.
      const running = layer.getAnimations?.({ subtree: true }) ?? [];
      if (running.length === 0) layer.remove();
      else void Promise.allSettled(running.map(a => a.finished)).then(() => layer.remove());
    };
  }, []);

  return useMemo<FxLayer>(() => {
    // Sin capa o sin Web Animations no hay efectos (tests, navegadores viejos).
    const target = () => {
      const layer = layerRef.current;
      return layer && typeof layer.animate === "function" ? layer : null;
    };

    const inkSplash: FxLayer["inkSplash"] = (color, x, y, big = false) => {
      const layer = target();
      if (!layer || reducedRef.current) return;
      for (const blob of inkBlobs(Math.random, { x, y, color, big })) {
        const el = piece(layer, "absolute rounded-full", {
          left: `${blob.left}px`,
          top: `${blob.top}px`,
          width: `${blob.width}px`,
          height: `${blob.height}px`,
          background: blob.color,
          borderRadius: blob.borderRadius,
        });
        run(
          el,
          [
            { transform: "scale(0)", opacity: 0.95 },
            { transform: "scale(1.1)", opacity: 0.9, offset: 0.25 },
            { transform: "scale(1.25)", opacity: 0 },
          ],
          { duration: blob.duration, delay: blob.delay, easing: "cubic-bezier(.2,.8,.3,1)", fill: "backwards" },
        );
      }
    };

    const floatPoints: FxLayer["floatPoints"] = (text, from, to) => {
      const layer = target();
      if (!layer) return;
      const el = piece(
        layer,
        "absolute whitespace-nowrap text-base font-extrabold text-rl-ok-text [text-shadow:0_2px_6px_rgba(0,0,0,.6)]",
        {},
      );
      el.textContent = text;
      const x = `${from.left + 40}px`;
      const y = from.top;
      if (reducedRef.current || !to) {
        run(
          el,
          [
            { left: x, top: `${y - 26}px`, opacity: 0 },
            { left: x, top: `${y - 26}px`, opacity: 1, offset: 0.3 },
            { left: x, top: `${y - 26}px`, opacity: 0 },
          ],
          { duration: 1100 },
        );
        return;
      }
      run(
        el,
        [
          { left: x, top: `${y}px`, transform: "scale(.6)", opacity: 0 },
          { left: x, top: `${y - 26}px`, transform: "scale(1.2)", opacity: 1, offset: 0.3 },
          { left: `${to.left}px`, top: `${to.top}px`, transform: "scale(.8)", opacity: 0 },
        ],
        { duration: 1100, easing: "cubic-bezier(.4,0,.2,1)" },
      );
    };

    const bigFlash: FxLayer["bigFlash"] = (text, sub) => {
      const layer = target();
      if (!layer) return;
      const box = piece(layer, "absolute inset-0 flex flex-col items-center justify-center", {});
      const big = document.createElement("div");
      big.className = "font-marker text-[clamp(40px,12vw,64px)] text-white [text-shadow:0_4px_0_rgba(0,0,0,.3)] [transform:rotate(-5deg)]";
      big.textContent = text;
      const pts = document.createElement("div");
      pts.className = "mt-1.5 text-[28px] font-extrabold text-rl-ok-text";
      pts.textContent = sub;
      box.append(big, pts);
      if (!reducedRef.current) {
        big.animate(
          [
            { transform: "rotate(-5deg) scale(2.4)", opacity: 0 },
            { transform: "rotate(-5deg) scale(.95)", opacity: 1, offset: 0.6 },
            { transform: "rotate(-5deg) scale(1)" },
          ],
          { duration: 400, easing: "cubic-bezier(.2,.9,.3,1)" },
        );
      }
      const total = FLASH_HOLD_MS + FLASH_FADE_MS;
      run(box, [{ opacity: 1 }, { opacity: 1, offset: FLASH_HOLD_MS / total }, { opacity: 0 }], { duration: total });
    };

    const confetti: FxLayer["confetti"] = count => {
      const layer = target();
      if (!layer || reducedRef.current) return;
      for (const c of confettiPieces(Math.random, count)) {
        const el = piece(layer, "absolute -top-5 h-3.5 w-[9px] rounded-[2px]", { left: `${c.left}vw`, background: c.color });
        run(el, [{ transform: "translateY(0) rotate(0)" }, { transform: `translate(${c.drift}px, 110vh) rotate(${c.spin}deg)` }], {
          duration: c.duration,
          delay: c.delay,
          easing: "cubic-bezier(.3,.6,.5,1)",
          fill: "backwards",
        });
      }
    };

    return { inkSplash, floatPoints, bigFlash, confetti };
  }, []);
}
