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
