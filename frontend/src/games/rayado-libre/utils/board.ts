/**
 * Ancho interno fijo del tablero, en píxeles del espacio de coordenadas
 * compartido (no de pantalla).
 *
 * Todos los clientes (quien dibuja y quienes observan) renderizan esta misma
 * resolución interna y la escalan por CSS a su propio tamaño — así los puntos
 * de un trazo se guardan y transmiten en un único sistema de coordenadas y no
 * requieren normalización por dispositivo.
 */
export const CANVAS_WIDTH = 800;

/**
 * Alto interno fijo del tablero, en píxeles del espacio de coordenadas
 * compartido. Ver {@link CANVAS_WIDTH}. El tablero es cuadrado (hoja de
 * papel de la referencia visual): si cambia, revisar `drawCoord` en
 * packages/shared-types y la clase `aspect-square` del `<canvas>`.
 */
export const CANVAS_HEIGHT = 800;

/**
 * Color del papel del tablero (`--color-rl-paper` en theme/tailwind.css).
 * La goma y el "borrar todo" pintan con este color en vez de blanco, así lo
 * borrado se funde con la hoja en vez de dejar manchas blancas encima.
 */
export const PAPER_COLOR = "#fbf7ee";
