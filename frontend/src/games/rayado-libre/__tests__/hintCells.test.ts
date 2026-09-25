import { describe, expect, test } from "vitest";
import { hintCells, letterCount, newlyRevealed } from "../utils/hintCells";

describe("hintCells", () => {
  test("splits a hint into revealed letters (uppercased), blanks and spaces", () => {
    expect(hintCells("_a_ b")).toEqual([
      { kind: "blank", char: "_" },
      { kind: "letter", char: "A" },
      { kind: "blank", char: "_" },
      { kind: "space", char: " " },
      { kind: "letter", char: "B" },
    ]);
  });

  test("a full word (drawer view) is all letters", () => {
    expect(hintCells("Ñandú").map(c => c.kind)).toEqual(["letter", "letter", "letter", "letter", "letter"]);
    expect(
      hintCells("Ñandú")
        .map(c => c.char)
        .join(""),
    ).toBe("ÑANDÚ");
  });
});

describe("letterCount", () => {
  test("counts every character except spaces", () => {
    expect(letterCount("____")).toBe(4);
    expect(letterCount("__a_ _i__")).toBe(8);
    expect(letterCount("")).toBe(0);
  });
});

describe("newlyRevealed", () => {
  test("indices hidden before and revealed now", () => {
    expect(newlyRevealed("____ ____", "_a__ ___o")).toEqual([1, 8]);
  });

  test("nothing new when the hint didn't change", () => {
    expect(newlyRevealed("_a__", "_a__")).toEqual([]);
  });

  test("a hint of a different length is a different word: nothing to animate", () => {
    expect(newlyRevealed("____", "_a___")).toEqual([]);
  });
});
