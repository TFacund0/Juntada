import { useState } from "react";
import { getGame } from "../games/registry";
import { consumeJoinLink } from "../features/multiplayer/utils/joinLink";

/**
 * Sesión "activa" persistida en `sessionStorage`.
 *
 * Recuerda qué juego/modo estaba activo para que, si el navegador (típicamente
 * en mobile) descarta la página entera estando en segundo plano — no solo
 * corta el socket, sino que mata el contexto de JS — la app pueda volver a
 * esa misma sala online al reabrirse, en vez de mostrar el selector de juegos
 * desde cero.
 */
interface ActiveSession {
  gameId: string;
  mode: "local" | "multi";
}

const ACTIVE_KEY = "impostorgame:active";

/** Lee la sesión activa guardada, o `null` si no hay ninguna (o es inválida). */
function loadActive(): ActiveSession | null {
  try {
    return JSON.parse(sessionStorage.getItem(ACTIVE_KEY) ?? "null");
  } catch {
    return null;
  }
}

/** Guarda la sesión activa, o la borra si se pasa `null`. */
function saveActive(value: ActiveSession | null): void {
  try {
    if (value) sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* storage no disponible (modo privado, etc.) — degradar en silencio */
  }
}

export type { ActiveSession };
export { loadActive, saveActive };

/**
 * Consume, una sola vez, un link de "unirse" pendiente en la URL actual
 * (`?join=CODE&game=id` para una sala, o `?join=CODE&kind=group` para un
 * grupo).
 *
 * Un link escaneado siempre gana por sobre una sesión activa restaurada: si
 * el jugador escaneó un QR explícitamente, la intención es ir ahí, no volver
 * a donde estaba antes. Se calcula una sola vez (inicializador perezoso de
 * `useState`) porque `consumeJoinLink()` limpia la URL como efecto colateral
 * y no debe volver a ejecutarse en cada render. Un link de grupo no trae
 * juego — el juego recién se sabe cuando el jugador elige (o se une a) uno
 * desde adentro del grupo.
 */
export function useValidJoinLink() {
  const [validJoinLink] = useState(() => {
    const link = consumeJoinLink();
    if (!link) return null;
    if (link.kind === "room" && !getGame(link.gameId)) return null;
    return link;
  });
  return validJoinLink;
}
