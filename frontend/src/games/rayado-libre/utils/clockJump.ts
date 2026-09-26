/** Lo que hace falta del turno para saber si el reloj saltó. */
export interface ClockSnapshot {
  timerEnd: number;
  /** Cuántos acertaron hasta ahora (`correctGuessers.length`). */
  correctCount: number;
}

export interface ClockJump {
  from: number;
  to: number;
}

const secondsLeft = (timerEnd: number, now: number) => Math.max(0, Math.ceil((timerEnd - now) / 1000));

/**
 * Detecta un salto del reloj por acierto (ver `scoreForGuess`: el primer
 * acierto en cada zona baja el reloj a 60 o 30). Hacen falta las dos
 * condiciones — el reloj bajó Y alguien acertó — para que un `timerEnd`
 * que baja por otro motivo (un reenvío corregido del servidor) no cuente.
 *
 * @returns `from`/`to` en segundos restantes, o `null` si no hubo salto.
 */
export function detectClockJump(prev: ClockSnapshot, next: ClockSnapshot, now: number): ClockJump | null {
  if (next.timerEnd >= prev.timerEnd || next.correctCount <= prev.correctCount) return null;
  const from = secondsLeft(prev.timerEnd, now);
  const to = secondsLeft(next.timerEnd, now);
  return to < from ? { from, to } : null;
}

/** Número a mostrar durante la cuenta del salto: de `from` a `to` en forma lineal, `t` de 0 a 1. */
export function jumpCountAt(jump: ClockJump, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return Math.round(jump.from + (jump.to - jump.from) * k);
}

/** Los últimos 10 segundos (sin contar el 0): el reloj late, suena y vibra. */
export function isUrgent(secs: number): boolean {
  return secs > 0 && secs <= 10;
}
