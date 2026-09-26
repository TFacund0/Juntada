import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "../../../components/game-kit/hooks/usePrefersReducedMotion";
import { useAnimationGate } from "../../../components/game-kit/hooks/useAnimationGate";

// `show()` de la referencia: la pantalla que se va sube 10px y se
// desvanece (200ms); la que llega entra desde 14px más abajo (300ms).
const OUT: Keyframe[] = [{ opacity: 1 }, { opacity: 0, transform: "translateY(-10px)" }];
const IN: Keyframe[] = [
  { opacity: 0, transform: "translateY(14px)" },
  { opacity: 1, transform: "none" },
];
const OUT_MS = 200;
const IN_MS = 300;
const IN_EASING = "cubic-bezier(.2,.8,.3,1)";

const canUseWaapi = (el: HTMLElement | null): el is HTMLElement => !!el && typeof el.animate === "function";

/**
 * Cambio de pantalla de Rayado Libre (elegir → dibujar → revelación →
 * podio). A diferencia de `PhaseTransition` (solo la entrada), acá la
 * pantalla anterior se queda montada los 200ms de su salida y recién
 * después entra la nueva. Sin Web Animations, con movimiento reducido o al
 * volver de otra pestaña el cambio es inmediato: se muestra el estado
 * actual sin animaciones atrasadas.
 */
export function ScreenSwap({ screenKey, children }: { screenKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const canAnimate = useAnimationGate();
  const [shownKey, setShownKey] = useState(screenKey);
  // Lo último que se dibujó de la pantalla que se está yendo.
  const lastShown = useRef<ReactNode>(children);
  const leaving = shownKey !== screenKey;
  if (!leaving) lastShown.current = children;

  useLayoutEffect(() => {
    if (!leaving) return;
    const el = ref.current;
    if (!canUseWaapi(el) || reduced || !canAnimate()) {
      setShownKey(screenKey);
      return;
    }
    const out = el.animate(OUT, { duration: OUT_MS, fill: "forwards" });
    out.onfinish = () => setShownKey(screenKey);
    return () => {
      out.onfinish = null;
      out.cancel();
    };
  }, [leaving, screenKey, reduced, canAnimate]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!canUseWaapi(el) || !canAnimate()) return;
    el.animate(IN, { duration: reduced ? 1 : IN_MS, easing: IN_EASING });
    // Solo cuando entra una pantalla nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey]);

  return (
    <div key={shownKey} ref={ref}>
      {leaving ? lastShown.current : children}
    </div>
  );
}
