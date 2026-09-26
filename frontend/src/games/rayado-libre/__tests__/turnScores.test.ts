import { describe, expect, test } from "vitest";
import { buildTurnScoreRows, countUpValue, flipOffsets, scoreReason, sortByTotal } from "../utils/turnScores";

const players = [
  { id: "ana", name: "Ana" },
  { id: "beto", name: "Beto" },
  { id: "caro", name: "Caro" },
  { id: "dani", name: "Dani" },
];

describe("scoreReason", () => {
  test("guesser with seconds, drawer with or without guesses, and nobody-guessed", () => {
    expect(scoreReason(false, 57, 57)).toBe("adivinó con 57s");
    expect(scoreReason(true, 20, undefined)).toBe("+10 por cada acierto");
    expect(scoreReason(true, 0, undefined)).toBe("nadie adivinó");
    expect(scoreReason(false, 0, undefined)).toBe("no adivinó");
  });

  test("an older server without guessSeconds still says the player guessed", () => {
    expect(scoreReason(false, 60, undefined)).toBe("adivinó");
  });
});

describe("buildTurnScoreRows", () => {
  const rows = buildTurnScoreRows({
    players,
    drawerId: "ana",
    roundPoints: { beto: 60, dani: 31, ana: 20 },
    guessSeconds: { beto: 72, dani: 31 },
    totals: { ana: 50, beto: 70, caro: 40, dani: 31 },
    myId: "dani",
  });

  test("derives the total before the turn and the reason for each row", () => {
    const dani = rows.find(r => r.id === "dani")!;
    expect(dani).toMatchObject({ plus: 31, before: 0, after: 31, isMe: true, why: "adivinó con 31s" });
    expect(rows.find(r => r.id === "ana")).toMatchObject({ isDrawer: true, before: 30, why: "+10 por cada acierto" });
    expect(rows.find(r => r.id === "caro")).toMatchObject({ plus: 0, before: 40, after: 40, why: "no adivinó" });
  });

  test("rows enter ordered by the score before the turn", () => {
    expect(rows.map(r => r.id)).toEqual(["caro", "ana", "beto", "dani"]);
  });

  test("and get reordered by the new total", () => {
    expect(sortByTotal(rows).map(r => r.id)).toEqual(["beto", "ana", "caro", "dani"]);
  });

  test("ties keep the room order (stable)", () => {
    const tied = buildTurnScoreRows({ players, drawerId: null, roundPoints: {}, totals: {} });
    expect(tied.map(r => r.id)).toEqual(["ana", "beto", "caro", "dani"]);
    expect(sortByTotal(tied).map(r => r.id)).toEqual(["ana", "beto", "caro", "dani"]);
  });
});

describe("countUpValue", () => {
  test("goes from → to with a cubic ease-out, clamped", () => {
    expect(countUpValue(10, 70, 0)).toBe(10);
    expect(countUpValue(10, 70, 0.5)).toBe(63); // 10 + 60 * 0.875 = 62.5 → 63
    expect(countUpValue(10, 70, 1)).toBe(70);
    expect(countUpValue(10, 70, 2)).toBe(70);
  });
});

describe("flipOffsets", () => {
  test("only rows that moved, offset back to where they were", () => {
    const before = new Map([
      ["a", 0],
      ["b", 50],
      ["c", 100],
    ]);
    const after = new Map([
      ["a", 50],
      ["b", 0],
      ["c", 100],
    ]);
    expect([...flipOffsets(before, after)]).toEqual([
      ["a", -50],
      ["b", 50],
    ]);
  });
});
