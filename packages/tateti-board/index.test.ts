import { describe, expect, it } from "vitest";
import { checkWinner } from "./index";

describe("checkWinner", () => {
  it("detects a horizontal win", () => {
    const board = ["X", "X", "X", null, null, null, null, null, null];
    expect(checkWinner(board)).toEqual([0, 1, 2]);
  });

  it("detects a diagonal win", () => {
    const board = ["O", null, null, null, "O", null, null, null, "O"];
    expect(checkWinner(board)).toEqual([0, 4, 8]);
  });

  it("returns null when nobody has won yet", () => {
    const board = ["X", "O", null, null, "X", null, null, null, "O"];
    expect(checkWinner(board)).toBeNull();
  });

  it("returns null on an empty board", () => {
    expect(checkWinner(Array(9).fill(null))).toBeNull();
  });
});
