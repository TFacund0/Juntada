import { useEffect, useRef } from "react";
import type { RayadoSfx } from "./useRayadoSfx";
import { useFxLayer } from "./useFxLayer";
import { canAnimateNow } from "./useMountMotion";
import { RAYADO_RAINBOW } from "../rainbow";

/** `lastGuess` de la vista privada: mi último acierto (el motor sube `guessId` con cada uno). */
export interface LastGuess {
  playerId: string;
  points: number;
  guessId: number;
}

/**
 * Mi acierto (la rama `youOk` de la referencia): "¡Adivinaste!" gigante con
 * "+N puntos", manchas arcoíris sobre la hoja, 40 papelitos, el arpegio y
 * la vibración larga. Vive en RoundView y no en la pantalla de dibujo
 * porque si fui el último en adivinar el motor pasa a la revelación en el
 * mismo mensaje: el festejo igual tiene que verse. Una vez por `guessId`:
 * la vista privada vuelve a llegar por otros motivos, y lo que ya estaba al
 * montar (reconectar) o llegó con la pestaña oculta no se festeja.
 */
export function useMyGuessCelebration(lastGuess: LastGuess | undefined, sfx: Pick<RayadoSfx, "play" | "vibrate">): void {
  const fx = useFxLayer();
  const seenId = useRef(lastGuess?.guessId ?? null);

  useEffect(() => {
    if (!lastGuess || lastGuess.guessId === seenId.current) return;
    seenId.current = lastGuess.guessId;
    if (!canAnimateNow()) return;
    sfx.play("youOk");
    sfx.vibrate([30, 40, 80]);
    fx.bigFlash("¡Adivinaste!", `+${lastGuess.points} puntos`);
    // Sobre la hoja si todavía está; si el turno ya terminó, en el centro.
    const board = document.querySelector("[data-rl-board]")?.getBoundingClientRect();
    const x = board ? board.left + board.width / 2 : window.innerWidth / 2;
    const y = board ? board.top + board.height / 2 : window.innerHeight / 2;
    // Grandes y arcoíris (el color solo cuenta para las chicas).
    fx.inkSplash(RAYADO_RAINBOW[2], x, y, true);
    fx.confetti(40);
    // Solo cuando llega un acierto nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastGuess?.guessId]);
}
