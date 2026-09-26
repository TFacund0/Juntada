import { describe, expect, test } from "vitest";
import type { DrawAction } from "@juntada/rayado-libre-scoring";
import { stepSize, strokeWidth } from "../utils/palette";
import { isClearTransition } from "../utils/clearTransition";
import { scribbleLevels } from "../utils/scribble";

const stroke = (strokeId: number): DrawAction => ({ type: "stroke", points: [[1, 1]], color: "#1a1a1a", size: 10, strokeId });
const fill: DrawAction = { type: "fill", x: 5, y: 5, color: "#e2432a" };

describe("strokeWidth / stepSize", () => {
  test("the eraser is 2.5 times the chosen size", () => {
    expect(strokeWidth({ mode: "draw", color: "#000", size: 10 })).toBe(10);
    expect(strokeWidth({ mode: "fill", color: "#000", size: 10 })).toBe(10);
    expect([4, 10, 20].map(size => strokeWidth({ mode: "erase", color: "#000", size }))).toEqual([10, 25, 50]);
  });

  test("steps between 4, 10 and 20", () => {
    expect(stepSize(4, 1)).toBe(10);
    expect(stepSize(10, -1)).toBe(4);
    expect(stepSize(20, 1)).toBeNull();
    expect(stepSize(4, -1)).toBeNull();
  });
});

describe("isClearTransition", () => {
  test("emptying a board with more than one undo unit is a clear", () => {
    expect(isClearTransition([stroke(1), stroke(1), stroke(2)], [], false)).toBe(true);
    expect(isClearTransition([stroke(1), fill], [], false)).toBe(true);
  });

  test("emptying a single unit could be an undo: only a clear if this device asked for it", () => {
    expect(isClearTransition([stroke(1), stroke(1)], [], false)).toBe(false);
    expect(isClearTransition([fill], [], false)).toBe(false);
    expect(isClearTransition([stroke(1), stroke(1)], [], true)).toBe(true);
  });

  test("an already empty board or one that still has something is not a clear", () => {
    expect(isClearTransition([], [], true)).toBe(false);
    expect(isClearTransition([stroke(1), stroke(2)], [stroke(1)], true)).toBe(false);
  });
});

describe("scribbleLevels", () => {
  test("volume and pitch follow the stroke speed, capped like the reference", () => {
    expect(scribbleLevels(0)).toEqual({ gain: 0, frequency: 1800 });
    expect(scribbleLevels(2)).toEqual({ gain: 0.024, frequency: 2400 });
    expect(scribbleLevels(100)).toEqual({ gain: 0.09, frequency: 4200 });
  });
});
