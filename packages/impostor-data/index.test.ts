import { describe, expect, it } from "vitest";
import { CATEGORIES, wordHint } from "./index";

describe("wordHint", () => {
  it("returns the hint for a known category/word pair", () => {
    expect(wordHint("futbolistas", "Messi")).toBe("Se movía por arriba o por las bandas, cerca del gol");
  });

  it("returns null for an unknown category", () => {
    expect(wordHint("no-existe", "Messi")).toBeNull();
  });

  it("returns null for a known category but unknown word", () => {
    expect(wordHint("futbolistas", "No Existe")).toBeNull();
  });
});

describe("CATEGORIES", () => {
  it("gives every word in each category its own hint", () => {
    for (const [key, category] of Object.entries(CATEGORIES)) {
      for (const word of category.words) {
        expect(category.hints[word], `${key}/${word} is missing a hint`).toBeTruthy();
      }
    }
  });
});
