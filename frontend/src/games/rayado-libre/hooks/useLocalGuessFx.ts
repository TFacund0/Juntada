import { useMemo, type RefObject } from "react";
import { avatarColor } from "../../../components/ui/Avatar";
import { useAnimationGate } from "../../../components/game-kit/hooks/useAnimationGate";
import type { LocalPlayer } from "../types/localGame";
import type { RayadoSfx } from "./useRayadoSfx";
import { useFxLayer } from "./useFxLayer";
import { useGuessFx } from "./useGuessFx";
import { localGuessEvents } from "../utils/guessEvents";

interface LocalGuessFxInput {
  rootRef: RefObject<HTMLElement | null>;
  players: readonly LocalPlayer[];
  correctGuessers: readonly number[];
  points: Record<number, number>;
  sfx: RayadoSfx;
}

/**
 * Los efectos de cada acierto que se marca en "¿Quién acertó?" (ver
 * useGuessFx): mancha junto al nombre, los puntos al reloj y el ding doble.
 * La pantalla es de toda la mesa: nunca es "mi" acierto.
 */
export function useLocalGuessFx({ rootRef, players, correctGuessers, points, sfx }: LocalGuessFxInput): void {
  const fx = useFxLayer();
  const canAnimate = useAnimationGate();
  const guesses = useMemo(
    () => localGuessEvents({ correctGuessers, players, points, colorOf: avatarColor }),
    [correctGuessers, players, points],
  );
  useGuessFx({ guesses, iAmDrawer: false, rootRef, sfx, fx, canAnimate, otherSound: true });
}
