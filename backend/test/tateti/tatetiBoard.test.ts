import { test } from "node:test";
import assert from "node:assert/strict";
import { checkWinner } from "@juntada/tateti-board";

test("checkWinner detects each of the 8 winning lines", () => {
  const cases: [(string | null)[], number[]][] = [
    [
      ["X", "X", "X", null, null, null, null, null, null],
      [0, 1, 2],
    ],
    [
      [null, null, null, "O", "O", "O", null, null, null],
      [3, 4, 5],
    ],
    [
      ["X", null, null, "X", null, null, "X", null, null],
      [0, 3, 6],
    ],
    [
      ["X", null, null, null, "X", null, null, null, "X"],
      [0, 4, 8],
    ],
    [
      [null, null, "X", null, "X", null, "X", null, null],
      [2, 4, 6],
    ],
  ];
  for (const [board, line] of cases) assert.deepEqual(checkWinner(board), line);
});

test("checkWinner returns null for an empty or non-winning board", () => {
  assert.equal(checkWinner(Array(9).fill(null)), null);
  assert.equal(checkWinner(["X", "O", "X", "O", "X", "O", "O", "X", "O"]), null);
});
