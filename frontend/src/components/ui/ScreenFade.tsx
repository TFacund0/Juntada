import type { ReactNode } from "react";
import "../../theme/screenTransitions.css";

/**
 * Fade-in liviano para un cambio de pantalla que no justifica la cortina
 * completa (ver useCurtainTransition) — remonta su contenido cada vez que
 * `transitionKey` cambia, lo que dispara la animación de entrada en
 * screenTransitions.css en vez de un corte instantáneo.
 *
 * `direction` es opcional: solo App.tsx (el único llamador cuyo
 * `transitionKey` realmente sube y baja entre pasos — elegir juego → elegir
 * modo → jugar, y volver) sabe calcular si este cambio es "para adelante" o
 * "para atrás" (ver stepDirection en useAppNavigation.ts); el resto de los
 * usos (MultiplayerGame, NameOnboardingScreen) tienen una sola pantalla fija
 * por instancia, sin noción de ida/vuelta, así que se quedan con el fade
 * "forward" de siempre por defecto.
 */
export function ScreenFade({
  transitionKey,
  direction = "forward",
  children,
}: {
  transitionKey: string;
  direction?: "forward" | "back";
  children: ReactNode;
}) {
  return (
    <div key={transitionKey} className={direction === "back" ? "screen-fade-in screen-fade-in--back" : "screen-fade-in"}>
      {children}
    </div>
  );
}
