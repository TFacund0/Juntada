import { describe, expect, it } from "vitest";
import { buildHintOrder, computeWordHint, isCorrectGuess, maxHintsFor, popLastDrawUnit, scoreForGuess, type DrawAction } from "./index";

describe("scoreForGuess", () => {
  it("scores a flat 60 and jumps to 60s in zone 1", () => {
    expect(scoreForGuess(90)).toEqual({ points: 60, jumpToSeconds: 60 });
  });

  it("scores the remaining seconds and jumps to 30s in zone 2", () => {
    expect(scoreForGuess(45)).toEqual({ points: 45, jumpToSeconds: 30 });
  });

  it("scores the remaining seconds with no jump in zone 3", () => {
    expect(scoreForGuess(10)).toEqual({ points: 10, jumpToSeconds: null });
  });

  it("clamps negative seconds to 0", () => {
    expect(scoreForGuess(-5)).toEqual({ points: 0, jumpToSeconds: null });
  });
});

describe("isCorrectGuess", () => {
  it("is case/accent/whitespace-insensitive", () => {
    expect(isCorrectGuess("  CAMION  ", "Camión")).toBe(true);
  });

  it("keeps ñ distinct from n", () => {
    expect(isCorrectGuess("montana", "Montaña")).toBe(false);
  });

  it("rejects an empty guess", () => {
    expect(isCorrectGuess("", "Camión")).toBe(false);
  });
});

describe("maxHintsFor / computeWordHint", () => {
  it("never reveals more than just under half the letters", () => {
    const word = "Camión";
    expect(maxHintsFor(word)).toBeLessThan(word.length / 2);
  });

  it("reveals nothing at time 0 and caps out at maxHintsFor", () => {
    const word = "Camión";
    const order = buildHintOrder(word);
    expect(computeWordHint(word, order, 0)).toBe("______");
    const capped = computeWordHint(word, order, 100000);
    const revealedCount = [...capped].filter(c => c !== "_").length;
    expect(revealedCount).toBe(maxHintsFor(word));
  });

  it("keeps spaces visible from the start", () => {
    const word = "De niño";
    expect(computeWordHint(word, buildHintOrder(word), 0)).toContain(" ");
  });
});

describe("popLastDrawUnit", () => {
  it("removes a whole multi-chunk stroke at once", () => {
    const strokes: DrawAction[] = [
      { type: "stroke", points: [[0, 0]], color: "#000", size: 2, strokeId: 1 },
      { type: "stroke", points: [[1, 1]], color: "#000", size: 2, strokeId: 1 },
      { type: "fill", x: 0, y: 0, color: "#fff" },
    ];
    const result = popLastDrawUnit(strokes);
    expect(result).toHaveLength(2);
  });

  it("removes a lone fill/clear action", () => {
    const strokes: DrawAction[] = [{ type: "clear" }];
    expect(popLastDrawUnit(strokes)).toHaveLength(0);
  });

  it("returns an empty array (not the same reference) for an empty input", () => {
    const strokes: DrawAction[] = [];
    const result = popLastDrawUnit(strokes);
    expect(result).toEqual([]);
  });
});
