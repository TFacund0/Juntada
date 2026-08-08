import { useRef, useEffect } from "react";
import type { GameDef } from "../games/gameTypes";
import { isGameAvailable } from "../games/maintenance";
import { useCurtainTransition } from "./useCurtainTransition";

interface UseStepTransitionArgs {
  gameId: string | null;
  groupFlow: boolean;
  game: GameDef | null | undefined;
  mode: "local" | "multi" | null;
}

/**
 * Cortina de transición (fundido a negro entre juegos con tema propio) y
 * `stepKey`/`stepDirection` (qué "paso" de arriba está en pantalla, y si el
 * cambio hacia ese paso se siente como ir "para adelante" o "para atrás") —
 * extraído tal cual de useAppNavigation.ts.
 */
export function useStepTransition({ gameId, groupFlow, game, mode }: UseStepTransitionArgs) {
  const { curtain, withCurtain, withAsyncCurtain, settleAsyncCurtain } = useCurtainTransition();

  // Identifica qué "paso" de arriba está en pantalla — cambia con cada
  // transición real de vista (elegir juego → elegir modo → jugar), pero se
  // mantiene estable mientras se navega *dentro* de un paso (ej. las fases
  // internas de MultiplayerGame), así ScreenFade sólo remonta/anima en los
  // saltos que de verdad se sienten como un cambio de pantalla.
  const stepKey =
    !gameId && !groupFlow
      ? "picker"
      : gameId && game?.localOnly && isGameAvailable(game) && !mode
        ? `localonly-${gameId}`
        : gameId && !mode && game && isGameAvailable(game) && !game.localOnly
          ? `modepicker-${gameId}`
          : mode === "local" && game
            ? `local-${gameId}`
            : mode === "multi" && (gameId || groupFlow)
              ? "multi"
              : "empty";

  // Dirección del ScreenFade (App.tsx) para este cambio de paso — un rango
  // fijo por prefijo de stepKey (elegir juego → elegir modo → jugar) en vez
  // de comparar los strings enteros, ya que dos stepKey del mismo "nivel"
  // (ej. dos juegos distintos en modepicker-*) deben seguir sintiéndose como
  // un salto lateral, no como ir "para atrás". El ref guarda el stepKey
  // anterior y se actualiza recién en el efecto (después de este render),
  // así la comparación de acá arriba siempre ve el valor previo al cambio
  // actual, no el que se acaba de calcular.
  const stepRank = (key: string) =>
    key === "picker" ? 0 : key.startsWith("modepicker-") || key.startsWith("localonly-") ? 1 : key === "empty" ? 1 : 2;
  const prevStepKeyRef = useRef(stepKey);
  const stepDirection: "forward" | "back" = stepRank(stepKey) < stepRank(prevStepKeyRef.current) ? "back" : "forward";
  useEffect(() => {
    prevStepKeyRef.current = stepKey;
  }, [stepKey]);

  return {
    curtain,
    withCurtain,
    withAsyncCurtain,
    settleAsyncCurtain,
    stepKey,
    stepDirection,
  };
}
