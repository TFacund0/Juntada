import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { CATEGORIES, categoryLabelOf } from "@juntada/rayado-libre-data";
import { canAnimateNow, useMountMotion } from "../../hooks/useMountMotion";
import type { RayadoSfx } from "../../hooks/useRayadoSfx";
import {
  CARD_CHOOSE_WAIT_MS,
  CARD_CHOSEN_MS,
  CARD_ENTER_MS,
  CARD_STAGGER_MS,
  cardChosen,
  cardDropped,
  cardEnter,
  cardLift,
  fanTransform,
  stripeColor,
} from "../../utils/wordFan";

interface WordCardFanProps {
  words: readonly string[];
  onChoose: (word: string) => void;
  sfx: Pick<RayadoSfx, "play" | "vibrate">;
}

// Palabras propias del anfitrión: no vienen de ninguna categoría.
const CUSTOM_LABEL = "Palabra propia";

/**
 * Abanico de 3 cartas de papel (`chooseWord` de la referencia): franja de
 * color arriba, palabra en marcador y su categoría debajo. Entran desde
 * abajo una tras otra con sonido de carta; con el mouse encima se levantan;
 * al elegir, la elegida sube y se achica mientras las otras caen giradas, y
 * recién al terminar se avisa la elección. Sin Web Animations o con
 * movimiento reducido todo es inmediato. Las cartas conservan la clase
 * `rl-word-card` que usan los e2e.
 */
export function WordCardFan({ words, onChoose, sfx }: WordCardFanProps) {
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const baseId = useId();
  // Movimiento reducido / sin Web Animations / recién vuelto de otra app: sin animaciones.
  const animated = useMountMotion();

  // Entrada: una tras otra desde abajo, cada una con su "tac".
  useEffect(() => {
    if (!canAnimateNow()) return;
    const timers = cards.current.map((card, i) => {
      if (animated) {
        card?.animate(cardEnter(fanTransform(i)), {
          duration: CARD_ENTER_MS,
          delay: i * CARD_STAGGER_MS,
          easing: "cubic-bezier(.2,.9,.3,1.1)",
          fill: "backwards",
        });
      }
      return setTimeout(() => sfx.play("card"), i * CARD_STAGGER_MS);
    });
    return () => timers.forEach(clearTimeout);
    // Solo al aparecer el abanico.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La elección se avisa cuando termina la animación de salida.
  useEffect(() => {
    if (chosen === null) return;
    if (!animated) {
      onChoose(chosen);
      return;
    }
    const t = setTimeout(() => onChoose(chosen), CARD_CHOOSE_WAIT_MS);
    return () => clearTimeout(t);
    // Solo una vez por elección.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen]);

  const lift = (i: number, up: boolean) => {
    if (chosen !== null || !animated) return;
    cards.current[i]?.animate?.(cardLift(fanTransform(i), up), { duration: 160, fill: "forwards" });
  };

  const choose = (word: string) => {
    if (chosen !== null) return;
    sfx.play("card");
    sfx.vibrate(15);
    if (animated) {
      cards.current.forEach((card, k) => {
        const transform = fanTransform(k);
        if (words[k] === word) {
          card?.animate(cardChosen(transform), { duration: CARD_CHOSEN_MS, easing: "cubic-bezier(.5,0,.3,1)", fill: "forwards" });
        } else {
          card?.animate(cardDropped(transform), { duration: 420, easing: "ease-in", fill: "forwards" });
        }
      });
    }
    setChosen(word);
  };

  return (
    <div className="relative h-[230px] w-full">
      {words.map((word, i) => {
        const categoryId = `${baseId}-cat-${i}`;
        return (
          <button
            key={word}
            ref={el => {
              cards.current[i] = el;
            }}
            type="button"
            aria-label={word}
            aria-describedby={categoryId}
            disabled={chosen !== null}
            onClick={() => choose(word)}
            onPointerEnter={() => lift(i, true)}
            onPointerLeave={() => lift(i, false)}
            className={
              "rl-word-card absolute left-1/2 top-0 -ml-16 flex h-[184px] w-32 origin-[50%_120%] cursor-pointer flex-col items-center " +
              "justify-center gap-2.5 overflow-hidden rounded-[14px] border-0 bg-rl-paper p-2.5 text-[#241c10] " +
              "shadow-[0_14px_30px_rgba(0,0,0,.5)] disabled:cursor-default " +
              "before:absolute before:inset-x-0 before:top-0 before:h-[9px] before:bg-[var(--stripe)]"
            }
            // Posición en el abanico y color de la franja: dependen de la carta.
            style={{ transform: fanTransform(i), "--stripe": stripeColor(i) } as CSSProperties}
          >
            <span className="font-marker text-[25px] leading-[1.05]">{word}</span>
            <small id={categoryId} className="text-xs font-bold text-[#8a7c60]">
              {categoryLabelOf(CATEGORIES, word) ?? CUSTOM_LABEL}
            </small>
          </button>
        );
      })}
    </div>
  );
}
