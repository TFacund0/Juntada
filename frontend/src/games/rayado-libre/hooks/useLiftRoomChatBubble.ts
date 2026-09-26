import { useEffect, type RefObject } from "react";

// La burbuja flotante del chat de la sala (FloatingChat) lee su distancia al
// borde inferior y su tamaño de estas variables (ver useFloatingChatDrag y
// FloatingChat); sin ellas queda como en todos los juegos.
const BOTTOM_VAR = "--jt-chat-bubble-bottom";
const SIZE_VAR = "--jt-chat-bubble-size";
// 2 y 3 columnas: abajo a la derecha está el input de respuestas fijo al
// pie (y "escribiendo…" encima): la burbuja sube lo justo para no taparlos.
// Pie: padding inferior (10/18px) + input (~64px) + "escribiendo" (22px) ≈
// 104px, más aire.
const LIFTED = "calc(128px + env(safe-area-inset-bottom, 0px))";
// Celular (apilado): el chat ocupa todo el ancho y cualquier lugar abajo
// tapa mensajes, así que la burbuja se achica y se sienta en la fila de la
// cabecera "Respuestas" (que le deja lugar a la derecha, ver ChatHeader).
const PHONE_MAX_WIDTH = 700;
const PHONE_SIZE = 40;
const MIN_BOTTOM = 8;
const SETTLE_MS = 350;

/**
 * Acomoda la burbuja del chat de la sala solo mientras la pantalla de
 * dibujo online está montada; al salir vuelve a su lugar y tamaño de
 * siempre. `rootRef` es la pantalla, donde se busca la cabecera del chat
 * (`[data-rl-chat-head]`) y su contenedor `[data-rl-stage]` (el ancho que decide
 * el layout).
 */
export function useLiftRoomChatBubble(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const doc = document.documentElement;
    const head = rootRef.current?.querySelector<HTMLElement>("[data-rl-chat-head]") ?? null;
    const stage = head?.closest<HTMLElement>("[data-rl-stage]") ?? null;

    const place = () => {
      if (head && stage && stage.getBoundingClientRect().width < PHONE_MAX_WIDTH) {
        const r = head.getBoundingClientRect();
        const bottom = window.innerHeight - r.bottom + (r.height - PHONE_SIZE) / 2;
        doc.style.setProperty(SIZE_VAR, `${PHONE_SIZE}px`);
        doc.style.setProperty(BOTTOM_VAR, `${Math.max(MIN_BOTTOM, Math.round(bottom))}px`);
      } else {
        doc.style.removeProperty(SIZE_VAR);
        doc.style.setProperty(BOTTOM_VAR, LIFTED);
      }
    };
    place();
    // Otra vez cuando termina la entrada de la pantalla (ver ScreenSwap), que la corre unos px al aparecer.
    const settle = setTimeout(place, SETTLE_MS);

    // La cabecera se mueve si cambia lo de arriba (el chat es lo que sobra
    // del alto), al abrir el teclado o al rotar.
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    if (stage) ro?.observe(stage);
    if (head?.parentElement) ro?.observe(head.parentElement);
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    return () => {
      clearTimeout(settle);
      ro?.disconnect();
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
      doc.style.removeProperty(BOTTOM_VAR);
      doc.style.removeProperty(SIZE_VAR);
    };
    // La pantalla de dibujo no cambia de nodo mientras está montada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
