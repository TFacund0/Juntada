import { useEffect, useRef } from "react";

// Breakpoint de dos columnas — tiene que coincidir con el min-width:900px
// que gatilla jt-lobby-grid/jt-lobby-col/jt-lobby-config-scroll en
// LobbyScreen.css (no hay forma de leer ese valor desde JS, así que ambos
// lados quedan documentados entre sí en vez de solo uno de los dos).
const DESKTOP_BREAKPOINT_PX = 900;
// Mismo 600px que el max-height de respaldo en LobbyScreen.css (por si este
// cálculo corre antes de que el CSS haya aplicado, o si JS está deshabilitado).
const LOBBY_COL_MAX_HEIGHT_PX = 600;
// Piso para que una columna nunca quede recortada a casi nada en una
// ventana muy baja (notebook con poca altura, teclado en pantalla, etc).
const LOBBY_COL_MIN_HEIGHT_PX = 200;
// Aire extra debajo del cálculo exacto (altura disponible = viewport menos
// el propio top de la columna menos la barra fija) para no dejarla pegada
// al pixel justo del borde inferior.
const LOBBY_COL_BOTTOM_GAP_PX = 16;

/**
 * El techo de altura de Jugadores/Config (LobbyScreen.css les da un tope
 * fijo relativo al viewport para que ninguno empuje la página ni se pase
 * por encima de la barra de "Iniciar ronda") no puede ser un solo valor de
 * CSS: cuánto aire hay arriba de cada columna cambia según el juego, si
 * hay tabbedLobby, y cuál tab está activa (ej. "Configuración" arranca más
 * abajo que "Jugadores" porque el código/QR de la sala sigue visible
 * arriba de las dos). Medimos acá en vez de adivinar un número fijo en el
 * CSS, que o dejaba aire de más en una tab o se solapaba con la barra fija
 * en la otra. Solo aplica desde el breakpoint de dos columnas (LobbyScreen
 * .css) — en mobile las columnas no tienen techo a propósito, se alargan
 * lo que haga falta y scrollea la página entera, como cualquier pantalla
 * larga de celular.
 *
 * Devuelve los 3 refs sin adjuntarlos — quien use este hook decide dónde
 * van en el JSX (colRef/configScrollRef en las dos columnas de la grilla,
 * actionBarRef dentro del createPortal de la barra de acción).
 */
export function useLobbyColumnMaxHeight({
  lobbyTab,
  isHost,
  activeGameId,
  playerCount,
  maxPlayers,
  visibleSeatCount,
}: {
  lobbyTab: "players" | "config";
  isHost: boolean;
  activeGameId: string | undefined;
  playerCount: number;
  maxPlayers: number;
  visibleSeatCount: number;
}) {
  const colRef = useRef<HTMLDivElement>(null);
  const configScrollRef = useRef<HTMLDivElement>(null);
  const actionBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const recompute = () => {
      const els = [colRef.current, configScrollRef.current];
      if (window.innerWidth < DESKTOP_BREAKPOINT_PX) {
        for (const el of els) if (el) el.style.maxHeight = "";
        return;
      }
      const barHeight = actionBarRef.current?.getBoundingClientRect().height ?? 0;
      for (const el of els) {
        if (!el) continue;
        const available = window.innerHeight - el.getBoundingClientRect().top - barHeight - LOBBY_COL_BOTTOM_GAP_PX;
        el.style.maxHeight = `${Math.max(LOBBY_COL_MIN_HEIGHT_PX, Math.min(LOBBY_COL_MAX_HEIGHT_PX, available))}px`;
      }
    };
    recompute();
    // Un frame después: la primera medición puede caer antes de que el
    // ConfigPanel del juego activo (cargado por Suspense) termine de pintar
    // su contenido real.
    const raf = requestAnimationFrame(recompute);
    window.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("resize", recompute);
      cancelAnimationFrame(raf);
    };
  }, [lobbyTab, isHost, activeGameId, playerCount, maxPlayers, visibleSeatCount]);

  return { colRef, configScrollRef, actionBarRef };
}
