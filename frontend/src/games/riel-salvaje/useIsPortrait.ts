import { useEffect, useState } from "react";

// DESIGN.md sección 8: el tablero se juega en landscape (el tren necesita
// ancho) — todo lo demás del lobby queda en portrait. Este hook es lo único
// que decide si hay que tapar el tablero con el cartel de "girá tu
// teléfono", comparando el viewport en vez de leer la Screen Orientation
// API (no soportada en todos los navegadores móviles, sobre todo iOS
// Safari) — más tosco, pero funciona en cualquier lado.
function computeIsPortrait(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerHeight > window.innerWidth;
}

export function useIsPortrait(): boolean {
  const [portrait, setPortrait] = useState(computeIsPortrait);

  useEffect(() => {
    const onChange = () => setPortrait(computeIsPortrait());
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);

  return portrait;
}
