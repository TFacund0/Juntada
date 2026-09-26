// Reglas del scroll del chat de respuestas (ver ChatFeed), tal cual la
// referencia: `nearBottom` y el texto del botón "↓ N nuevos".

/** A menos de esto del final se considera que el usuario "está abajo" y sigue cada mensaje nuevo. */
export const NEAR_BOTTOM_PX = 40;

export function isNearBottom({
  scrollHeight,
  scrollTop,
  clientHeight,
}: Pick<HTMLElement, "scrollHeight" | "scrollTop" | "clientHeight">): boolean {
  return scrollHeight - scrollTop - clientHeight < NEAR_BOTTOM_PX;
}

export function newMessagesLabel(count: number): string {
  return `↓ ${count} nuevo${count > 1 ? "s" : ""}`;
}
