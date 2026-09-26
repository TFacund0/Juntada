import { describe, expect, test } from "vitest";
import { floodFill, isAlreadyFilled, type Rgba } from "../utils/floodFill";

const W = 20;
const H = 20;
const PAPER: Rgba = [251, 247, 238, 255];
const INK: Rgba = [26, 26, 26, 255];
const RED: Rgba = [226, 67, 42, 255];
// Borde suavizado claro (a 75 del papel): tiene que quedar cubierto por el relleno.
const SOFT_EDGE: Rgba = [225, 222, 214, 255];

function sheet(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) data.set(PAPER, i * 4);
  return data;
}
const set = (data: Uint8ClampedArray, x: number, y: number, c: Rgba) => data.set(c, (y * W + x) * 4);
const get = (data: Uint8ClampedArray, x: number, y: number): number[] => Array.from(data.slice((y * W + x) * 4, (y * W + x) * 4 + 4));

// Cuadrado cerrado de tinta de (5,5) a (14,14), con un píxel de borde suave adentro.
function closedSquare(): Uint8ClampedArray {
  const data = sheet();
  for (let i = 5; i <= 14; i++) {
    set(data, i, 5, INK);
    set(data, i, 14, INK);
    set(data, 5, i, INK);
    set(data, 14, i, INK);
  }
  set(data, 6, 6, SOFT_EDGE);
  return data;
}

describe("floodFill", () => {
  test("fills only the inside of a closed shape", () => {
    const data = closedSquare();
    expect(floodFill(data, W, H, 10, 10, RED)).toBe(true);
    expect(get(data, 10, 10)).toEqual([...RED]);
    expect(get(data, 13, 13)).toEqual([...RED]);
    expect(get(data, 5, 10)).toEqual([...INK]);
    expect(get(data, 2, 2)).toEqual([...PAPER]);
    expect(get(data, 18, 18)).toEqual([...PAPER]);
  });

  test("covers antialiased edge pixels within tolerance (no light halo)", () => {
    const data = closedSquare();
    floodFill(data, W, H, 10, 10, RED);
    expect(get(data, 6, 6)).toEqual([...RED]);
  });

  test("stops at pixels beyond the tolerance", () => {
    const data = closedSquare();
    set(data, 7, 7, [150, 150, 150, 255]);
    floodFill(data, W, H, 10, 10, RED);
    expect(get(data, 7, 7)).toEqual([150, 150, 150, 255]);
  });

  test("an open shape floods the whole sheet without running forever", () => {
    const data = sheet();
    expect(floodFill(data, W, H, 0, 0, RED)).toBe(true);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) expect(get(data, x, y)).toEqual([...RED]);
  });

  test("out-of-bounds start is a no-op", () => {
    const data = closedSquare();
    const before = data.slice();
    expect(floodFill(data, W, H, -1, 3, RED)).toBe(false);
    expect(floodFill(data, W, H, 3, H, RED)).toBe(false);
    expect(data).toEqual(before);
  });

  test("tapping an area that is already (almost) the fill color is a no-op", () => {
    const data = closedSquare();
    const before = data.slice();
    expect(floodFill(data, W, H, 10, 10, [PAPER[0] + 3, PAPER[1], PAPER[2], 255])).toBe(false);
    expect(data).toEqual(before);
  });

  test("is deterministic: same input, same output", () => {
    const a = closedSquare();
    const b = closedSquare();
    floodFill(a, W, H, 10.7, 10.2, RED);
    floodFill(b, W, H, 10.7, 10.2, RED);
    expect(a).toEqual(b);
  });
});

describe("isAlreadyFilled", () => {
  test("opaque and within 10 of the fill color", () => {
    expect(isAlreadyFilled([10, 10, 10, 255], [12, 12, 12, 255])).toBe(true);
    expect(isAlreadyFilled([10, 10, 10, 255], [15, 15, 15, 255])).toBe(false);
    expect(isAlreadyFilled([10, 10, 10, 200], [10, 10, 10, 255])).toBe(false);
  });
});
