import { useState } from "react";
import { usePrefersReducedMotion } from "../../../components/game-kit/hooks/usePrefersReducedMotion";
import { canAnimateAt } from "../../../components/game-kit/hooks/useAnimationGate";

const supportsWaapi = () => typeof HTMLElement !== "undefined" && typeof HTMLElement.prototype.animate === "function";

// Desde cuándo la página está a la vista, a nivel módulo: una pantalla que
// se monta justo al volver de otra app (porque el estado cambió mientras
// tanto) no tiene un useAnimationGate propio que lo sepa todavía.
let visibleSince = Number.NEGATIVE_INFINITY;
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") visibleSince = Date.now();
  });
}

/** Si ahora corresponde animar un evento (ver canAnimateAt), con el regreso a la pestaña medido para toda la app. */
export const canAnimateNow = () =>
  typeof document !== "undefined" && canAnimateAt(Date.now(), document.visibilityState === "hidden", visibleSince);

/**
 * Si una pantalla con secuencia de entrada (elegir palabra, revelación,
 * podio) la anima o aparece directo en su estado final — decidido una sola
 * vez al montar: sin Web Animations (tests), con movimiento reducido, o al
 * montarse con la pestaña oculta o recién vuelta, se muestra el resultado
 * sin animaciones atrasadas.
 */
export function useMountMotion(): boolean {
  const reduced = usePrefersReducedMotion();
  const [animated] = useState(() => supportsWaapi() && !reduced && canAnimateNow());
  return animated;
}
