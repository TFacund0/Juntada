import { describe, expect, it } from "vitest";
import { matchWinner, maxImpostors } from "./index";

describe("maxImpostors", () => {
  it("keeps impostors a strict minority", () => {
    expect(maxImpostors(3)).toBe(1);
    expect(maxImpostors(5)).toBe(2);
    expect(maxImpostors(8)).toBe(3);
  });

  it("never returns less than 1", () => {
    expect(maxImpostors(1)).toBe(1);
    expect(maxImpostors(2)).toBe(1);
  });
});

describe("matchWinner", () => {
  it("returns 'innocents' once every impostor is eliminated", () => {
    expect(matchWinner(["a"], ["a"], 4)).toBe("innocents");
  });

  it("returns 'impostors' once they can no longer be outvoted", () => {
    expect(matchWinner(["a", "b"], ["c"], 4)).toBe("impostors");
  });

  it("returns null while the match is still undecided", () => {
    expect(matchWinner(["a"], [], 4)).toBeNull();
  });
});
