import { useEffect, useMemo } from "react";
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
 *
 * `skipAnimation` es para cuando la cortina (`useCurtainTransition`) ya está
 * tapando *esta misma* transición (juego con tema propio entrando/saliendo
 * de él) — sin esto, el remount de acá abajo reproducía su propio fade/slide
 * a la vez que la cortina se levantaba, y las dos animaciones pisadas se
 * leían como un salto raro/doble en vez de una sola transición prolija.
 */
export function ScreenFade({
  transitionKey,
  direction = "forward",
  skipAnimation = false,
  children,
}: {
  transitionKey: string;
  direction?: "forward" | "back";
  skipAnimation?: boolean;
  children: ReactNode;
}) {
  // Esta app no tiene router (ver useAppNavigation.ts), así que nada resetea
  // el scroll del documento al cambiar de "pantalla" — el remount por `key`
  // de acá abajo solo anima el contenido, el scrollY del browser queda tal
  // cual estaba. Sin esto, tocar "Jugar" con el modal de detalle scrolleado
  // (algo común, es un CTA que suele quedar más abajo) dejaba la siguiente
  // pantalla (elegir Online/Local) mostrada arrancando desde ese mismo
  // scroll en vez de arriba de todo.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [transitionKey]);

  // Se "congela" al momento exacto en que este transitionKey aparece por
  // primera vez, no reactivo después: la cortina pasa de "in" a "out" a
  // "none" a lo largo de los ~380ms siguientes mientras este mismo nodo
  // sigue montado — si el cálculo se rehiciera en cada render, la clase de
  // animación se agregaría recién cuando la cortina ya se levantó,
  // reproduciendo un destello fuera de tiempo en vez de nunca haber corrido.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const frozenSkip = useMemo(() => skipAnimation, [transitionKey]);

  const animClass = frozenSkip ? "" : direction === "back" ? "screen-fade-in screen-fade-in--back" : "screen-fade-in";

  return (
    <div key={transitionKey} className={animClass}>
      {children}
    </div>
  );
}
