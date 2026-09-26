import { describe, expect, test } from "vitest";
import type { DrawAction } from "@juntada/rayado-libre-scoring";
import { inkAmount, latestPenTip, ownPenColor, penChange, penPosition } from "../utils/remotePen";

const stroke = (points: [number, number][], color = "#e2432a", strokeId = 1): DrawAction => ({
  type: "stroke",
  points,
  color,
  size: 10,
  strokeId,
});
const fill: DrawAction = { type: "fill", x: 10, y: 10, color: "#2e7dd6" };

describe("inkAmount", () => {
  test("counts stroke points plus one per fill/clear", () => {
    expect(inkAmount([])).toBe(0);
    expect(
      inkAmount([
        stroke([
          [0, 0],
          [1, 1],
        ]),
        fill,
      ]),
    ).toBe(3);
  });
});

describe("latestPenTip", () => {
  test("last point and color of the last stroke", () => {
    expect(
      latestPenTip([
        stroke([[5, 5]], "#000"),
        stroke(
          [
            [10, 20],
            [30, 40],
          ],
          "#e2432a",
          2,
        ),
      ]),
    ).toEqual({ x: 30, y: 40, color: "#e2432a" });
  });

  test("null when the last action isn't a stroke", () => {
    expect(latestPenTip([stroke([[5, 5]]), fill])).toBeNull();
    expect(latestPenTip([])).toBeNull();
  });
});

describe("penChange", () => {
  const drawing = [
    stroke([
      [10, 10],
      [20, 20],
    ]),
  ];

  test("more ink from a stroke moves the pen to its tip", () => {
    expect(penChange(0, drawing)).toEqual({ kind: "move", tip: { x: 20, y: 20, color: "#e2432a" } });
  });

  test("the same drawing broadcast again changes nothing", () => {
    expect(penChange(2, drawing)).toEqual({ kind: "none" });
  });

  test("undo or clear (less ink) hides the pen", () => {
    expect(penChange(5, drawing)).toEqual({ kind: "hide" });
    expect(penChange(5, [])).toEqual({ kind: "hide" });
  });

  test("a fill hides the pen (nothing to follow)", () => {
    expect(penChange(2, [...drawing, fill])).toEqual({ kind: "hide" });
  });
});

describe("penPosition", () => {
  test("board coordinates become % of the sheet, whatever size it is shown at", () => {
    expect(penPosition(400, 200, 800, 800)).toEqual({ left: "50%", top: "25%" });
    expect(penPosition(0, 800, 800, 800)).toEqual({ left: "0%", top: "100%" });
  });
});

describe("ownPenColor", () => {
  test("only the pencil gets the drawer's own marker, in its color", () => {
    expect(ownPenColor({ mode: "draw", color: "#e2432a" })).toBe("#e2432a");
    expect(ownPenColor({ mode: "erase", color: "#e2432a" })).toBeNull();
    expect(ownPenColor({ mode: "fill", color: "#e2432a" })).toBeNull();
    expect(ownPenColor(undefined)).toBeNull();
  });
});
