import { describe, expect, test } from "vitest";
import { buildPlayerRows } from "../utils/playerRows";

const players = [
  { id: "a", name: "Ana" },
  { id: "b", name: "Beto" },
  { id: "c", name: "Cami" },
  { id: "d", name: "Dani" },
];

describe("buildPlayerRows", () => {
  test("sorted by cumulative score, highest first, keeping join order on ties", () => {
    const rows = buildPlayerRows({ players, scores: { b: 30, c: 90, d: 30 }, drawerId: null, correctGuessers: [], roundPoints: {} });
    expect(rows.map(r => [r.name, r.score])).toEqual([
      ["Cami", 90],
      ["Beto", 30],
      ["Dani", 30],
      ["Ana", 0],
    ]);
  });

  test("status per player: drawing, guessed (with this turn's points), typing, or nothing", () => {
    const rows = buildPlayerRows({
      players,
      scores: {},
      drawerId: "a",
      correctGuessers: ["b"],
      roundPoints: { a: 10, b: 60 },
      typingIds: ["c", "b"],
    });
    const byId = Object.fromEntries(rows.map(r => [r.id, r]));
    expect(byId.a.status).toBe("drawing");
    expect(byId.b.status).toBe("guessed");
    expect(byId.b.gained).toBe(60);
    expect(byId.c.status).toBe("typing");
    expect(byId.d.status).toBeNull();
  });

  test("without typing data, nobody shows as typing", () => {
    const rows = buildPlayerRows({ players, scores: {}, drawerId: "a", correctGuessers: [], roundPoints: {} });
    expect(rows.some(r => r.status === "typing")).toBe(false);
  });
});
