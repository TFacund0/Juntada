import { useEffect } from "react";

const DIRECTIVE = "interactive-widget=resizes-content";

/** Agrega la directiva al `content` de la meta viewport (sin duplicarla). */
export function withResizesContent(content: string): string {
  if (content.includes("interactive-widget")) return content;
  return content.trim() ? `${content}, ${DIRECTIVE}` : DIRECTIVE;
}

/**
 * Mientras Rayado está en pantalla, el viewport incluye
 * `interactive-widget=resizes-content`: en Android el teclado achica el
 * layout (y con él el tablero, que se mide en `dvh`) en vez de taparlo. Se
 * restaura el valor original al salir para no cambiar el resto de la app.
 */
export function useResizesContentViewport(): void {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;
    const original = meta.getAttribute("content") ?? "";
    meta.setAttribute("content", withResizesContent(original));
    return () => meta.setAttribute("content", original);
  }, []);
}
