import type { ReactNode } from "react";
import "../../theme/screenTransitions.css";

/**
 * Fade-in liviano para un cambio de pantalla que no justifica la cortina
 * completa (ver useCurtainTransition) — remonta su contenido cada vez que
 * `transitionKey` cambia, lo que dispara la animación de entrada en
 * screenTransitions.css en vez de un corte instantáneo.
 */
export function ScreenFade({ transitionKey, children }: { transitionKey: string; children: ReactNode }) {
  return (
    <div key={transitionKey} className="screen-fade-in">
      {children}
    </div>
  );
}
