import { describe, expect, it } from "vitest";
import { scoreFor, SCORE_ZONES } from "./index";

describe("scoreFor", () => {
  it("scores an exact guess (diff 0) with the top zone's points", () => {
    expect(scoreFor(0)).toBe(SCORE_ZONES[0].points);
  });

  it("scores each zone boundary with that zone's points", () => {
    for (const zone of SCORE_ZONES) {
      expect(scoreFor(zone.spread)).toBe(zone.points);
    }
  });

  it("scores anything past the last zone as 0", () => {
    const lastSpread = SCORE_ZONES[SCORE_ZONES.length - 1].spread;
    expect(scoreFor(lastSpread + 1)).toBe(0);
    expect(scoreFor(100)).toBe(0);
  });
});
