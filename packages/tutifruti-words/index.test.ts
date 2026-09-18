import { describe, expect, it } from "vitest";
import { normalizeWord, startsWithLetter } from "./index";

describe("normalizeWord", () => {
  it("lowercases, trims and strips accents", () => {
    expect(normalizeWord("  Camión  ")).toBe("camion");
  });

  it("keeps ñ distinct from n instead of stripping it to n", () => {
    expect(normalizeWord("Ñandú")).toBe("ñandu");
    expect(normalizeWord("Nube")).not.toBe(normalizeWord("Ñube"));
  });

  it("returns an empty string for undefined", () => {
    expect(normalizeWord(undefined)).toBe("");
  });
});

describe("startsWithLetter", () => {
  it("treats a genuinely empty answer as not wrong", () => {
    expect(startsWithLetter("", "A")).toBe(true);
    expect(startsWithLetter("   ", "A")).toBe(true);
  });

  it("rejects a non-empty word that normalizes to nothing (e.g. a lone accent)", () => {
    expect(startsWithLetter("´", "A")).toBe(false);
  });

  it("matches accent/case-insensitively", () => {
    expect(startsWithLetter("árbol", "A")).toBe(true);
    expect(startsWithLetter("Árbol", "a")).toBe(true);
  });

  it("correctly distinguishes Ñ from N", () => {
    expect(startsWithLetter("Ñandú", "N")).toBe(false);
    expect(startsWithLetter("Ñandú", "Ñ")).toBe(true);
  });

  it("rejects a word starting with a different letter", () => {
    expect(startsWithLetter("Banana", "A")).toBe(false);
  });
});
