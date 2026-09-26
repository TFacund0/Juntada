import { DRAWER_POINTS_PER_GUESS } from "@juntada/rayado-libre-scoring";

// Ayudas del modo local. Sus ids son números; las piezas compartidas con el
// online (panel de jugadores, tabla del turno) trabajan con strings.
export const toStringKeys = (record: Record<number, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [String(k), v]));

/** Lo ganado en el turno: lo de cada adivinador más los +10 por acierto de quien dibujó (como `roundPoints` del motor online). */
export function localRoundPoints(guesserPoints: Record<number, number>, drawerId: number | null): Record<number, number> {
  const guesses = Object.keys(guesserPoints).length;
  if (drawerId == null || guesses === 0) return { ...guesserPoints };
  return { ...guesserPoints, [drawerId]: guesses * DRAWER_POINTS_PER_GUESS };
}
