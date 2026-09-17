import { describe, expect, it } from "vitest";
import { COMMON_LETTERS, DEFAULT_CATEGORIES, LETTERS } from "./index";

describe("LETTERS / COMMON_LETTERS", () => {
  it("has the full 27-letter Spanish alphabet (including Ñ)", () => {
    expect(LETTERS).toHaveLength(27);
    expect(LETTERS).toContain("Ñ");
  });

  it("every common letter is a real letter from the full alphabet", () => {
    for (const letter of COMMON_LETTERS) {
      expect(LETTERS).toContain(letter);
    }
  });
});

describe("DEFAULT_CATEGORIES", () => {
  it("has no duplicate category ids", () => {
    const ids = DEFAULT_CATEGORIES.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every category a label and icon", () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(category.label.length).toBeGreaterThan(0);
      expect(category.icon.length).toBeGreaterThan(0);
    }
  });
});
