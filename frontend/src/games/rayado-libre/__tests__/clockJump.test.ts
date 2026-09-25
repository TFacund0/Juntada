import { describe, expect, test } from "vitest";
import { detectClockJump, isUrgent, jumpCountAt } from "../utils/clockJump";

const NOW = 1_000_000;
const at = (secondsLeft: number) => NOW + secondsLeft * 1000;

describe("detectClockJump", () => {
  test("a first correct guess that lowers the clock is a jump, in whole seconds left", () => {
    expect(detectClockJump({ timerEnd: at(88), correctCount: 0 }, { timerEnd: at(60), correctCount: 1 }, NOW)).toEqual({
      from: 88,
      to: 60,
    });
  });

  test("a reroll lowers the clock without a new guess: not a jump", () => {
    expect(detectClockJump({ timerEnd: at(90), correctCount: 0 }, { timerEnd: at(75), correctCount: 0 }, NOW)).toBeNull();
  });

  test("a guess that doesn't move the clock (zone already reached) is not a jump", () => {
    expect(detectClockJump({ timerEnd: at(40), correctCount: 1 }, { timerEnd: at(40), correctCount: 2 }, NOW)).toBeNull();
  });

  test("the same state broadcast again is not a jump", () => {
    const s = { timerEnd: at(50), correctCount: 1 };
    expect(detectClockJump(s, { ...s }, NOW)).toBeNull();
  });

  test("a new turn (clock goes up, guesses reset) is not a jump", () => {
    expect(detectClockJump({ timerEnd: at(5), correctCount: 2 }, { timerEnd: at(99), correctCount: 0 }, NOW)).toBeNull();
  });
});

describe("jumpCountAt", () => {
  test("counts linearly from `from` to `to`, clamped to the ends", () => {
    const jump = { from: 90, to: 60 };
    expect(jumpCountAt(jump, 0)).toBe(90);
    expect(jumpCountAt(jump, 0.5)).toBe(75);
    expect(jumpCountAt(jump, 1)).toBe(60);
    expect(jumpCountAt(jump, 2)).toBe(60);
    expect(jumpCountAt(jump, -1)).toBe(90);
  });
});

describe("isUrgent", () => {
  test("only the last 10 seconds, not counting zero", () => {
    expect(isUrgent(11)).toBe(false);
    expect(isUrgent(10)).toBe(true);
    expect(isUrgent(1)).toBe(true);
    expect(isUrgent(0)).toBe(false);
  });
});
