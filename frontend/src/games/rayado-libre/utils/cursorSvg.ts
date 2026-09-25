import { CANVAS_WIDTH } from "./board";
import { strokeWidth, type Tool } from "./palette";

// Cursor del tablero en compu (`updateCursor` de la referencia): un círculo
// SVG del tamaño y color reales del trazo, escalado a lo que mide el
// tablero en pantalla. La goma es un círculo sin relleno y el balde, una
// cruz. En pantallas táctiles no hay cursor, así que no hace falta nada más.

const MIN_RADIUS = 3;

/**
 * Valor de CSS `cursor` para la herramienta activa.
 *
 * @param tool Herramienta activa.
 * @param boardWidth Ancho del tablero en pantalla, en px (0 si todavía no se midió).
 */
export function cursorFor(tool: Tool, boardWidth: number): string {
  if (tool.mode === "fill") return "crosshair";
  // Mientras el tablero no tiene medida, la escala de la referencia (.5).
  const scale = boardWidth / CANVAS_WIDTH || 0.5;
  const erase = tool.mode === "erase";
  const r = Math.max(MIN_RADIUS, Math.round((strokeWidth(tool) * scale) / 2));
  const s = r * 2 + 4;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'>` +
    `<circle cx='${s / 2}' cy='${s / 2}' r='${r}' fill='${erase ? "none" : tool.color}' fill-opacity='.35' ` +
    `stroke='${erase ? "#333" : tool.color}' stroke-width='1.5'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${s / 2} ${s / 2}, crosshair`;
}
