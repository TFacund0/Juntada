import { describe, expect, it } from "vitest";
import {
  buildHintOrder,
  computeWordHint,
  isCloseGuess,
  isCorrectGuess,
  isOneEditAway,
  maxHintsFor,
  popLastDrawUnit,
  scoreForGuess,
  type DrawAction,
} from "./index";

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

describe("isOneEditAway", () => {
  it("accepts exactly one substitution, insertion or deletion", () => {
    expect(isOneEditAway("gato", "pato")).toBe(true);
    expect(isOneEditAway("gato", "gatos")).toBe(true);
    expect(isOneEditAway("gatos", "gato")).toBe(true);
    expect(isOneEditAway("gato", "ato")).toBe(true);
  });

  it("rejects identical strings and anything two or more edits away", () => {
    expect(isOneEditAway("gato", "gato")).toBe(false);
    expect(isOneEditAway("gato", "pata")).toBe(false);
    expect(isOneEditAway("gato", "ga")).toBe(false);
    expect(isOneEditAway("gato", "agto")).toBe(false);
  });
});

describe("isCloseGuess", () => {
  it("flags a one-letter typo, ignoring case and accents like isCorrectGuess", () => {
    expect(isCloseGuess("CAMIOM", "Camión")).toBe(true);
    expect(isCloseGuess("camin", "Camión")).toBe(true);
  });

  it("flags a prefix of 4+ letters, but not a shorter one", () => {
    expect(isCloseGuess("maripo", "Mariposa")).toBe(true);
    expect(isCloseGuess("mari", "Mariposa")).toBe(true);
    expect(isCloseGuess("mar", "Mariposa")).toBe(false);
  });

  it("never flags the exact word, an empty guess, or an unrelated one", () => {
    expect(isCloseGuess("camión", "Camión")).toBe(false);
    expect(isCloseGuess("   ", "Camión")).toBe(false);
    expect(isCloseGuess("perro", "Camión")).toBe(false);
  });

  it("keeps ñ distinct from n, so 'montana' is one edit from 'Montaña'", () => {
    expect(isCloseGuess("montana", "Montaña")).toBe(true);
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

  it("interleaves hints across every word of a phrase instead of exhausting the longest one first", () => {
    // "Osos Panda": group 0 = indices 0-3 ("Osos"), group 1 = indices 5-9
    // ("Panda"). Round-robin means the very first hint of the turn already
    // comes from group 0, and the second from group 1 — neither word is
    // left fully blank while the other gets revealed letter by letter.
    const word = "Osos Panda";
    const order = buildHintOrder(word);
    expect(order[0]).toBeGreaterThanOrEqual(0);
    expect(order[0]).toBeLessThanOrEqual(3);
    expect(order[1]).toBeGreaterThanOrEqual(5);
    expect(order[1]).toBeLessThanOrEqual(9);

    // maxHintsFor("Osos Panda") = floor((9-1)/2) = 4 — by then, at least one
    // letter from each word must already be visible.
    const hint = computeWordHint(word, order, 100000);
    const [osos, panda] = hint.split(" ");
    expect(osos).not.toBe("____");
    expect(panda).not.toBe("_____");
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
