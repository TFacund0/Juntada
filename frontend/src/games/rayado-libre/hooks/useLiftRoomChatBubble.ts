import { useEffect } from "react";

// La burbuja flotante del chat de la sala (FloatingChat) lee su distancia al
// borde inferior de esta variable (ver useFloatingChatDrag). Mientras se
// dibuja, abajo a la derecha está el input de respuestas fijo al pie (y la
// línea de "escribiendo…" encima): la burbuja sube lo justo para no taparlos.
// Alto del pie: padding inferior (10/18px) + input (~64px) + "escribiendo"
// (22px) ≈ 104px, más aire.
const VAR = "--jt-chat-bubble-bottom";
const LIFTED = "calc(128px + env(safe-area-inset-bottom, 0px))";

/** Sube la burbuja del chat de la sala solo mientras esta pantalla está montada; al salir vuelve a su lugar de siempre. */
export function useLiftRoomChatBubble(): void {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(VAR, LIFTED);
    return () => {
      root.style.removeProperty(VAR);
    };
  }, []);
}
