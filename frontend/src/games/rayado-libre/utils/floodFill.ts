// Balde de pintura: relleno por líneas (scanline) con tolerancia, portado
// de `floodFill` en docs/referencias/rayado-libre-referencia-v2.html. Opera
// sobre los píxeles crudos (RGBA) del tablero, sin DOM, para poder
// testearlo y para que todos los clientes (quien dibuja y quienes miran)
// rellenen exactamente igual al repintar el historial.

export type Rgba = readonly [number, number, number, number];

/**
 * Cuánto puede diferir un píxel del color tocado (suma de las diferencias
 * absolutas de R, G, B y A) y seguir contando como la misma región. Cubre
 * los bordes suavizados (antialias) de los trazos, que si no quedaban como
 * un halo blanco alrededor del relleno.
 */
export const FILL_TOLERANCE = 90;

/**
 * Si el píxel ya es (casi) del color de relleno, rellenar no cambiaría nada:
 * opaco y con R+G+B a menos de 10 de distancia.
 */
export function isAlreadyFilled(pixel: Rgba, fill: Rgba): boolean {
  return pixel[3] === 255 && Math.abs(pixel[0] - fill[0]) + Math.abs(pixel[1] - fill[1]) + Math.abs(pixel[2] - fill[2]) < 10;
}

/**
 * Rellena en el lugar (`data` se modifica) la región contigua (4 vecinos)
 * que se parece al píxel `(x, y)` dentro de {@link FILL_TOLERANCE}.
 *
 * Cada píxel se pinta a lo sumo una vez (lo marca `done`), así que el
 * trabajo está acotado por `width * height` aunque la forma esté abierta y
 * el relleno se escape a todo el tablero.
 *
 * @param data Píxeles RGBA del tablero, fila por fila (como `ImageData.data`).
 * @param width Ancho del tablero en píxeles.
 * @param height Alto del tablero en píxeles.
 * @param x Coordenada X tocada (se trunca a entero).
 * @param y Coordenada Y tocada (se trunca a entero).
 * @param fill Color de relleno; se pinta opaco.
 * @returns `true` si pintó algo; `false` si el punto está fuera del tablero o ya era de ese color.
 */
export function floodFill(data: Uint8ClampedArray, width: number, height: number, x: number, y: number, fill: Rgba): boolean {
  const sx = Math.floor(x);
  const sy = Math.floor(y);
  if (!(sx >= 0 && sy >= 0 && sx < width && sy < height)) return false;

  const at = (px: number, py: number) => (py * width + px) * 4;
  const i0 = at(sx, sy);
  const target: Rgba = [data[i0], data[i0 + 1], data[i0 + 2], data[i0 + 3]];
  if (isAlreadyFilled(target, fill)) return false;

  const matches = (i: number) =>
    Math.abs(data[i] - target[0]) +
      Math.abs(data[i + 1] - target[1]) +
      Math.abs(data[i + 2] - target[2]) +
      Math.abs(data[i + 3] - target[3]) <=
    FILL_TOLERANCE;
  const done = new Uint8Array(width * height);
  const stack: [number, number][] = [[sx, sy]];

  while (stack.length > 0) {
    const [startX, cy] = stack.pop() as [number, number];
    let cx = startX;
    let i = at(cx, cy);
    // Retrocede hasta el borde izquierdo de este tramo de la fila...
    while (cx >= 0 && matches(i) && !done[cy * width + cx]) {
      cx--;
      i -= 4;
    }
    cx++;
    i += 4;
    // ...y lo pinta hacia la derecha, anotando (una vez por tramo) dónde
    // sigue la región en la fila de arriba y en la de abajo.
    let up = false;
    let down = false;
    while (cx < width && matches(i) && !done[cy * width + cx]) {
      done[cy * width + cx] = 1;
      data[i] = fill[0];
      data[i + 1] = fill[1];
      data[i + 2] = fill[2];
      data[i + 3] = 255;
      if (cy > 0) {
        const k = i - width * 4;
        if (matches(k) && !done[(cy - 1) * width + cx]) {
          if (!up) {
            stack.push([cx, cy - 1]);
            up = true;
          }
        } else up = false;
      }
      if (cy < height - 1) {
        const k = i + width * 4;
        if (matches(k) && !done[(cy + 1) * width + cx]) {
          if (!down) {
            stack.push([cx, cy + 1]);
            down = true;
          }
        } else down = false;
      }
      cx++;
      i += 4;
    }
  }
  return true;
}
