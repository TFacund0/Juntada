import { useCallback, useRef, useState } from "react";

/**
 * Fundido a negro ("cortina") reproducido al entrar/salir de un juego con
 * tema propio (ver `gameTheme` en `GameDef`), para que el cambio de paleta
 * de toda la app siempre pase tapado en vez de como un corte brusco.
 *
 * Reservado a juegos con tema propio a propósito, no a todos: la pantalla de
 * destino (lobby/ronda) ya reproduce su propia entrada vía `<ScreenFade>` —
 * agregar la cortina encima de esa misma transición para *todo* juego hacía
 * que las dos animaciones corrieran pisadas (la cortina levantándose a la
 * vez que `<ScreenFade>` anima su propia entrada), leyéndose como un
 * movimiento raro/doble. Para un juego con tema propio esa cortina extra
 * tiene un propósito real (tapar el cambio de paleta); para el resto,
 * `<ScreenFade>` solo ya cubre la transición.
 */
export function useCurtainTransition() {
  const [curtain, setCurtain] = useState<"none" | "in" | "out">("none");

  /**
   * Variante síncrona (ej. "Modo local"): `action()` termina al instante, así
   * que alcanza con un timer fijo — no hay ningún viaje de ida y vuelta al
   * servidor que esperar.
   */
  const withCurtain = useCallback((action: () => void, themed: boolean) => {
    if (!themed || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      action();
      return;
    }
    setCurtain("in");
    setTimeout(() => {
      action();
      setCurtain("out");
      setTimeout(() => setCurtain("none"), 380);
    }, 260);
  }, []);

  /**
   * Ref al "settle" (asentamiento) de la cortina asíncrona actualmente en
   * curso, si hay una. Sirve como guarda: si una transición nueva reemplaza a
   * esta antes de que se resuelva, el settle/timeout viejo no debe tocar una
   * cortina que ya no es "suya".
   */
  const curtainSettleRef = useRef<(() => void) | null>(null);

  /**
   * Variante asíncrona, usada por crear/unirse online (ver `runTransition` en
   * `MultiplayerGame`): `action()` solo *envía* el pedido de crear/unirse; la
   * sala en sí llega después, por el socket, cuando el servidor responde. Un
   * timer fijo no sabe eso — en una conexión lenta la cortina se levantaba
   * antes de que la sala existiera, mostrando por un instante la vieja
   * pantalla de "Crear partida" antes de que el lobby real la reemplazara de
   * golpe, lo que se leía como que la transición "pasaba dos veces". Esta
   * variante mantiene la cortina abajo hasta que quien la llama avisa
   * explícitamente que la sala ya apareció (ver `onTransitionSettled` de
   * `MultiplayerGame`), con un piso mínimo para que una respuesta muy rápida
   * igual se perciba como una transición deliberada en vez de un flash
   * instantáneo, y un timeout de resguardo para que una conexión que nunca
   * responde no deje al jugador atrapado detrás del negro para siempre.
   */
  const withAsyncCurtain = useCallback((action: () => void, themed: boolean) => {
    if (!themed || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      action();
      return;
    }
    setCurtain("in");
    const shownAt = Date.now();
    const MIN_VISIBLE_MS = 400;
    const SAFETY_TIMEOUT_MS = 6000;
    const lift = () => {
      curtainSettleRef.current = null;
      setCurtain("out");
      setTimeout(() => setCurtain("none"), 380);
    };
    const settle = () => {
      // Una llamada posterior (una transición nueva) ya reemplazó a esta —
      // no dejar que un settle/timeout viejo levante una cortina que ya no
      // es "la suya".
      if (curtainSettleRef.current !== settle) return;
      const elapsed = Date.now() - shownAt;
      if (elapsed >= MIN_VISIBLE_MS) lift();
      else setTimeout(lift, MIN_VISIBLE_MS - elapsed);
    };
    curtainSettleRef.current = settle;
    setTimeout(action, 260);
    setTimeout(settle, SAFETY_TIMEOUT_MS);
  }, []);

  /**
   * Se llama una vez que la sala/grupo que esta cortina estaba tapando
   * efectivamente llegó (o falló) — ver el efecto que vigila `connectionPhase`
   * en `MultiplayerGame`.
   */
  const settleAsyncCurtain = useCallback(() => {
    curtainSettleRef.current?.();
  }, []);

  return { curtain, withCurtain, withAsyncCurtain, settleAsyncCurtain };
}
