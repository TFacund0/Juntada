import { describe, expect, it } from "vitest";
import { CATEGORIES, computeMatchRanks, isCorrectGuess, type QuienSoyResult } from "./index";

describe("isCorrectGuess", () => {
  it("matches an exact (normalized) guess", () => {
    expect(isCorrectGuess("messi", "Messi")).toBe(true);
    expect(isCorrectGuess("  MESSI  ", "Messi")).toBe(true);
  });

  it("matches a significant single-word guess against a multi-word answer", () => {
    expect(isCorrectGuess("Messi", "Lionel Messi")).toBe(true);
  });

  it("doesn't match a short filler word alone", () => {
    expect(isCorrectGuess("de", "Rey de Corazones")).toBe(false);
  });

  it("rejects a wrong guess", () => {
    expect(isCorrectGuess("Ronaldo", "Messi")).toBe(false);
  });
});

describe("computeMatchRanks", () => {
  it("ranks earlier laps higher and ties on the same lap", () => {
    const results: QuienSoyResult[] = [
      { playerId: "a", outcome: "solved", lap: 1 },
      { playerId: "b", outcome: "solved", lap: 2 },
      { playerId: "c", outcome: "solved", lap: 2 },
      { playerId: "d", outcome: "eliminated", lap: 1 },
    ];
    const ranks = computeMatchRanks(results, 4);
    expect(ranks.a.rank).toBe(1);
    expect(ranks.b.rank).toBe(2);
    expect(ranks.c.rank).toBe(2);
    expect(ranks.d).toBeUndefined();
    expect(ranks.a.points).toBeGreaterThan(ranks.b.points);
  });
});

describe("CATEGORIES", () => {
  it("has no empty word list", () => {
    for (const category of Object.values(CATEGORIES)) {
      expect(category.words.length).toBeGreaterThan(0);
    }
  });
});
