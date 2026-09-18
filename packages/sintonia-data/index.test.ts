import { describe, expect, it } from "vitest";
import { SPECTRUMS } from "./index";

describe("SPECTRUMS", () => {
  it("is non-empty and every entry is a distinct left/right pair", () => {
    expect(SPECTRUMS.length).toBeGreaterThan(0);
    for (const [left, right] of SPECTRUMS) {
      expect(left).not.toBe(right);
      expect(left.length).toBeGreaterThan(0);
      expect(right.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate pairs", () => {
    const seen = new Set(SPECTRUMS.map(([l, r]) => `${l}|${r}`));
    expect(seen.size).toBe(SPECTRUMS.length);
  });
});
