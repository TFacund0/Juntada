// Herramientas de dibujo de Rayado: colores, grosores y modos de la paleta
// (ver `PALETTE`, `PALETTE_NAMES` y `SIZES` en
// docs/referencias/rayado-libre-referencia-v2.html). Sin React ni DOM: lo
// usan la paleta, el canvas, el cursor y los atajos de teclado.

export type ToolMode = "draw" | "erase" | "fill";

export type Tool = { mode: ToolMode; color: string; size: number };

export const PALETTE = ["#1a1a1a", "#e2432a", "#2e7dd6", "#2fa85a", "#f2b705", "#a5459b", "#f2872e", "#7a5230", "#ffffff"] as const;

export const PALETTE_NAMES = ["Negro", "Rojo", "Azul", "Verde", "Amarillo", "Violeta", "Naranja", "Marrón", "Blanco"] as const;

export const SIZES = [4, 10, 20] as const;

export const SIZE_NAMES = ["fino", "medio", "grueso"] as const;

/** Herramienta con la que arranca cada turno. */
export const DEFAULT_TOOL: Tool = { mode: "draw", color: PALETTE[0], size: 10 };

/** La goma borra más ancho que el lápiz del mismo grosor (4→10, 10→25, 20→50), como en la referencia. */
export const ERASER_SCALE = 2.5;

/** Grosor real del trazo en coordenadas del tablero: el elegido, o el de la goma. */
export function strokeWidth(tool: Tool): number {
  return tool.mode === "erase" ? tool.size * ERASER_SCALE : tool.size;
}

/** Grosor vecino (`step` = -1 más fino, +1 más grueso), o `null` si ya está en el extremo. */
export function stepSize(size: number, step: -1 | 1): number | null {
  const next = SIZES[SIZES.indexOf(size as (typeof SIZES)[number]) + step];
  return next ?? null;
}
