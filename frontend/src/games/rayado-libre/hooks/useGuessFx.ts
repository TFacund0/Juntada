import { useEffect, useRef, type RefObject } from "react";
import type { RayadoSfx } from "./useRayadoSfx";
import type { FxLayer } from "./useFxLayer";
import type { GuessEvent } from "../utils/guessEvents";

interface GuessFxInput {
  guesses: readonly GuessEvent[];
  /** Soy quien dibuja: los aciertos de otros me dan "+10 para vos". */
  iAmDrawer: boolean;
  /** Pantalla donde buscar la línea de cada acierto y el reloj (`.rl-circular-timer`). */
  rootRef: RefObject<HTMLElement | null>;
  sfx: Pick<RayadoSfx, "play" | "vibrate">;
  fx: FxLayer;
  /** Ver useAnimationGate: nada por lo que pasó con la pestaña oculta. */
  canAnimate: () => boolean;
  /** El ding doble del acierto de otro; online ya lo toca el chat (useChatFeedback). */
  otherSound: boolean;
}

const rectOf = (root: HTMLElement | null, selector: string) => root?.querySelector(selector)?.getBoundingClientRect() ?? null;

/**
 * Efectos de cada acierto nuevo (`registerCorrect` de la referencia):
 * mancha de tinta del color del jugador junto a su línea y los puntos que
 * vuelan hasta el reloj ("+10 para vos" si dibujo yo); si es de otro,
 * además la vibración corta. El festejo grande de mi propio acierto va
 * aparte (useMyGuessCelebration). Los aciertos que ya estaban al montar (o
 * que llegaron con la pestaña oculta) no se festejan.
 */
export function useGuessFx({ guesses, iAmDrawer, rootRef, sfx, fx, canAnimate, otherSound }: GuessFxInput): void {
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(guesses.map(g => g.key));
      return;
    }
    const fresh = guesses.filter(g => !seen.current!.has(g.key));
    fresh.forEach(g => seen.current!.add(g.key));
    if (fresh.length === 0 || !canAnimate()) return;

    const root = rootRef.current;
    const ring = rectOf(root, ".rl-circular-timer");
    for (const g of fresh) {
      if (!g.mine) {
        if (otherSound) sfx.play("otherOk");
        sfx.vibrate(20);
      }
      const line = rectOf(root, `[data-fx-anchor="${g.key}"]`);
      if (!line) continue;
      fx.inkSplash(g.color, line.left + 30, line.top + 10);
      fx.floatPoints(iAmDrawer && !g.mine ? "+10 para vos" : `+${g.points}`, line, ring);
    }
    // Solo reacciona a aciertos nuevos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guesses]);
}
