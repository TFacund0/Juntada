import { useEffect, useRef } from "react";
import { isTypingTarget, resolveShortcut, type PaletteShortcut } from "../utils/shortcuts";

/**
 * Escucha el teclado mientras la paleta está montada (solo quien dibuja,
 * durante el dibujo) y pasa cada atajo a `onShortcut`. Las teclas escritas
 * en un input/textarea/contenido editable se ignoran. El mapa tecla →
 * acción vive en utils/shortcuts.ts.
 *
 * @param onShortcut Recibe la acción; pasa por los mismos handlers que los clics (sonido y rebote incluidos).
 * @param currentSize Grosor activo, para `[` y `]`.
 */
export function usePaletteShortcuts(onShortcut: (action: PaletteShortcut) => void, currentSize: number): void {
  const latest = useRef({ onShortcut, currentSize });
  useEffect(() => {
    latest.current = { onShortcut, currentSize };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e.target)) return;
      const action = resolveShortcut(e, latest.current.currentSize);
      if (!action) return;
      // Ctrl/Cmd+Z es "deshacer" del navegador: acá deshace el último trazo.
      if (action.type === "undo") e.preventDefault();
      latest.current.onShortcut(action);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}
