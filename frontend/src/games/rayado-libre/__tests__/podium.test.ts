import { describe, expect, test } from "vitest";
import { RAYADO_RAINBOW } from "../rainbow";
import { barBackground, barHeightPx, podiumRevealOrder, podiumSlots, podiumTitle, rankEntries } from "../utils/podium";

const entry = (id: string, score: number, isMe = false) => ({ id, name: id.toUpperCase(), score, isMe });

describe("podiumSlots", () => {
  test("3 players: 2nd | 1st | 3rd with the reference heights and colors", () => {
    const slots = podiumSlots([entry("a", 10), entry("b", 30), entry("c", 20)]);
    expect(slots.map(s => [s.entry.id, s.place, s.height, s.color])).toEqual([
      ["c", 2, 58, RAYADO_RAINBOW[3]],
      ["b", 1, 82, RAYADO_RAINBOW[4]],
      ["a", 3, 42, RAYADO_RAINBOW[1]],
    ]);
  });

  test("2 players: only 2nd | 1st", () => {
    expect(podiumSlots([entry("a", 5), entry("b", 9)]).map(s => [s.entry.id, s.place])).toEqual([
      ["a", 2],
      ["b", 1],
    ]);
  });

  test("4 or more: only the top 3", () => {
    const slots = podiumSlots([entry("a", 1), entry("b", 4), entry("c", 3), entry("d", 2)]);
    expect(slots.map(s => s.entry.id)).toEqual(["c", "b", "d"]);
  });
});

describe("podiumRevealOrder", () => {
  test("bars grow 3rd, 2nd, then 1st", () => {
    const slots = podiumSlots([entry("a", 10), entry("b", 30), entry("c", 20)]);
    expect(podiumRevealOrder(slots).map(i => slots[i].place)).toEqual([3, 2, 1]);
  });

  test("with 2 players: 2nd then 1st", () => {
    const slots = podiumSlots([entry("a", 5), entry("b", 9)]);
    expect(podiumRevealOrder(slots).map(i => slots[i].place)).toEqual([2, 1]);
  });
});

describe("rankEntries / podiumTitle", () => {
  test("ties keep the room order", () => {
    expect(rankEntries([entry("a", 3), entry("b", 3)]).map(e => e.id)).toEqual(["a", "b"]);
  });

  test("'¡Ganaste!' only when the winner is me", () => {
    expect(podiumTitle(entry("a", 3, true))).toBe("¡Ganaste!");
    expect(podiumTitle(entry("a", 3))).toBe("Ganó A");
    expect(podiumTitle(undefined)).toBe("Podio");
  });

  test("bar heights are their % of the fixed 260px bar area", () => {
    const slots = podiumSlots([entry("a", 10), entry("b", 30), entry("c", 20)]);
    expect(slots.map(s => barHeightPx(s.height))).toEqual([151, 213, 109]);
  });

  test("the bar darkens its own color toward the bottom", () => {
    expect(barBackground("#2e8bff")).toBe("linear-gradient(#2e8bff, color-mix(in srgb, #2e8bff 55%, #0f0c1d))");
  });
});
