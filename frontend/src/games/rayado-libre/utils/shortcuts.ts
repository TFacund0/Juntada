import { PALETTE, stepSize, type ToolMode } from "./palette";

// Atajos de teclado de la paleta en compu (`onKey` de la referencia):
// 1–9 colores, B lápiz, E goma, G balde, [ y ] grosor, Ctrl/Cmd+Z deshacer.

export type PaletteShortcut =
  { type: "color"; index: number } | { type: "mode"; mode: ToolMode } | { type: "size"; size: number } | { type: "undo" };

/** Lo que importa de un `KeyboardEvent` para decidir el atajo. */
export interface ShortcutKey {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

const MODE_KEYS: Record<string, ToolMode> = { b: "draw", e: "erase", g: "fill" };

/**
 * Traduce una tecla a una acción de la paleta.
 *
 * @param e Tecla apretada.
 * @param currentSize Grosor activo, para que `[`/`]` pasen al vecino.
 * @returns La acción, o `null` si la tecla no es un atajo (o el grosor ya está en el extremo).
 */
export function resolveShortcut(e: ShortcutKey, currentSize: number): PaletteShortcut | null {
  const k = e.key.toLowerCase();
  if (e.ctrlKey || e.metaKey) return k === "z" && !e.altKey ? { type: "undo" } : null;
  // Con Alt (o Ctrl/Cmd, arriba) la tecla es de otro atajo: del navegador o del sistema.
  if (e.altKey) return null;
  if (/^[1-9]$/.test(k) && Number(k) <= PALETTE.length) return { type: "color", index: Number(k) - 1 };
  if (k in MODE_KEYS) return { type: "mode", mode: MODE_KEYS[k] };
  if (k === "[" || k === "]") {
    const size = stepSize(currentSize, k === "]" ? 1 : -1);
    return size == null ? null : { type: "size", size };
  }
  return null;
}

/**
 * Si el foco está en un lugar donde se escribe (input, textarea, select o
 * contenido editable): ahí las teclas son texto, no atajos.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("input, textarea, select")) return true;
  return target.closest('[contenteditable]:not([contenteditable="false"])') !== null;
}
