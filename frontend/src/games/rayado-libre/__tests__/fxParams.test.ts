import { describe, expect, test } from "vitest";
import { RAYADO_RAINBOW } from "../rainbow";
import { confettiPieces, inkBlobs } from "../utils/fxParams";
import { fanTransform, stripeColor } from "../utils/wordFan";

// RNG fijo: siempre la mitad del rango.
const half = () => 0.5;

describe("inkBlobs", () => {
  test("a small splash: 4 blobs in the player's color, 40ms apart", () => {
    const blobs = inkBlobs(half, { x: 100, y: 200, color: "#123456" });
    expect(blobs).toHaveLength(4);
    expect(blobs.every(b => b.color === "#123456" && b.duration === 800)).toBe(true);
    expect(blobs.map(b => b.delay)).toEqual([0, 40, 80, 120]);
    // Tamaño a mitad de 24–60 (42px), centrado en el punto.
    expect(blobs[0]).toMatchObject({ width: 42, left: 100 - 21, top: 200 - 21 });
  });

  test("a big splash: 7 larger rainbow blobs", () => {
    const blobs = inkBlobs(half, { x: 0, y: 0, color: "#123456", big: true });
    expect(blobs).toHaveLength(7);
    expect(blobs.every(b => RAYADO_RAINBOW.includes(b.color) && b.duration === 1100 && b.width === 110)).toBe(true);
  });
});

describe("confettiPieces", () => {
  test("n pieces cycling the rainbow plus white", () => {
    const pieces = confettiPieces(half, 7);
    expect(pieces.map(p => p.color)).toEqual([...RAYADO_RAINBOW, "#ffffff", RAYADO_RAINBOW[0]]);
    expect(pieces[0]).toMatchObject({ left: 50, drift: 0, spin: 720, duration: 2400, delay: 150 });
  });
});

describe("word fan", () => {
  test("left, center and right positions", () => {
    expect(fanTransform(0)).toBe("translateX(-96px) translateY(20px) rotate(-14deg)");
    expect(fanTransform(1)).toBe("translateX(0px) translateY(0px) rotate(0deg)");
    expect(fanTransform(2)).toBe("translateX(96px) translateY(20px) rotate(14deg)");
  });

  test("stripes: red, green, violet", () => {
    expect([0, 1, 2].map(stripeColor)).toEqual([RAYADO_RAINBOW[0], RAYADO_RAINBOW[2], RAYADO_RAINBOW[4]]);
  });
});
