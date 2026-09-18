import { describe, expect, it } from "vitest";
import { activeWordPool, CATEGORIES, pickThreeWords } from "./index";

describe("activeWordPool", () => {
  it("combines words from every active category", () => {
    const pool = activeWordPool(CATEGORIES, ["animales", "objetos"]);
    expect(pool).toEqual([...CATEGORIES.animales.words, ...CATEGORIES.objetos.words]);
  });

  it("ignores an unknown category key", () => {
    expect(activeWordPool(CATEGORIES, ["no-existe"])).toEqual([]);
  });
});

describe("pickThreeWords", () => {
  it("picks 3 words not already used, without resetting", () => {
    const pool = ["a", "b", "c", "d", "e"];
    const { words, resetUsed } = pickThreeWords(pool, ["a"]);
    expect(words).toHaveLength(3);
    expect(words).not.toContain("a");
    expect(resetUsed).toBe(false);
  });

  it("resets (allows repeats) once fewer than 3 unused words remain", () => {
    const pool = ["a", "b", "c"];
    const { words, resetUsed } = pickThreeWords(pool, ["a", "b"]);
    expect(words).toHaveLength(3);
    expect(resetUsed).toBe(true);
  });
});
