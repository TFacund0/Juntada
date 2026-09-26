import { TYPING_SEND_INTERVAL_MS } from "@juntada/rayado-libre-scoring";

/**
 * Quiénes siguen escribiendo según `typingUntil` (id → cuándo vence, ver el
 * motor online), en el orden en que llegaron. El servidor ya excluye a
 * quien dibuja y a quien adivinó; acá solo se descarta lo vencido y, si se
 * pasa, el propio jugador (no tiene sentido avisarte que escribís vos).
 *
 * Se compara contra el reloj de este dispositivo: se asume que está en hora
 * con el del servidor, igual que el reloj del turno (`timerEnd`). Un
 * desfasaje de unos segundos solo alarga o acorta un poco los puntitos.
 */
export function activeTypingIds(typingUntil: Record<string, number> | undefined, now: number, excludeId?: string): string[] {
  if (!typingUntil) return [];
  return Object.entries(typingUntil)
    .filter(([id, until]) => until > now && id !== excludeId)
    .map(([id]) => id);
}

/** El próximo vencimiento todavía por venir, para re-evaluar justo ahí (o `null` si no queda ninguno). */
export function nextTypingExpiry(typingUntil: Record<string, number> | undefined, now: number): number | null {
  if (!typingUntil) return null;
  const pending = Object.values(typingUntil).filter(until => until > now);
  return pending.length > 0 ? Math.min(...pending) : null;
}

/** Si ya pasó el intervalo mínimo desde el último aviso de "escribiendo" (o nunca se mandó uno). */
export function shouldSendTyping(lastSentAt: number | null, now: number): boolean {
  return lastSentAt === null || now - lastSentAt >= TYPING_SEND_INTERVAL_MS;
}
