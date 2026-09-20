import { describe, expect, it } from "vitest";
import { HEX_RE, hexToRgb, hslToHex, randomTargetColor, scoreGuess } from "./index";

describe("hslToHex", () => {
  it("converts known HSL values to their hex equivalent", () => {
    expect(hslToHex(0, 100, 50)).toBe("#ff0000");
    expect(hslToHex(120, 100, 50)).toBe("#00ff00");
    expect(hslToHex(240, 100, 50)).toBe("#0000ff");
  });
});

describe("hexToRgb", () => {
  it("parses a hex string back into RGB channels", () => {
    expect(hexToRgb("#ff0000")).toEqual([255, 0, 0]);
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
  });
});

describe("randomTargetColor", () => {
  it("always returns a valid 6-digit hex color", () => {
    for (let i = 0; i < 30; i++) {
      expect(randomTargetColor()).toMatch(HEX_RE);
    }
  });
});

describe("scoreGuess", () => {
  it("scores an exact match as 10", () => {
    expect(scoreGuess("#ff0000", "#ff0000")).toBe(10);
  });

  it("scores the worst-case (black vs white) as 0", () => {
    expect(scoreGuess("#000000", "#ffffff")).toBe(0);
  });

  it("scores a closer guess higher than a farther one", () => {
    const close = scoreGuess("#ff0000", "#fe0000");
    const far = scoreGuess("#ff0000", "#00ff00");
    expect(close).toBeGreaterThan(far);
  });
});
