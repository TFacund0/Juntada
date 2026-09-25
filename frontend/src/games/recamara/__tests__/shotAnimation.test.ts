import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MAX_SPENT_SHELLS, useShotAnimation } from "../hooks/shotAnimation";
import { AIM_MS, SHOT_MS } from "../utils/timing";

describe("useShotAnimation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function fire(result: { current: ReturnType<typeof useShotAnimation> }, kind: "live" | "blank") {
    act(() => {
      result.current.playShot(90, kind);
    });
    act(() => {
      vi.advanceTimersByTime(AIM_MS + SHOT_MS);
    });
    act(() => result.current.finishShot());
  }

  it("plays aiming → firing → result, dropping a casing on the trigger", () => {
    const { result } = renderHook(() => useShotAnimation());
    expect(result.current.fireStage).toBe("idle");
    expect(result.current.spentShells).toEqual([]);

    act(() => {
      result.current.playShot(90, "live");
    });
    expect(result.current.fireStage).toBe("aiming");
    expect(result.current.gunAngle).toBe(90);
    expect(result.current.spentShells).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(AIM_MS);
    });
    expect(result.current.fireStage).toBe("firing");
    expect(result.current.spentShells).toHaveLength(1);
    expect(result.current.spentShells[0].kind).toBe("live");

    act(() => {
      vi.advanceTimersByTime(SHOT_MS);
    });
    expect(result.current.fireStage).toBe("result");
  });

  it("only the last casing stays (plus the previous one while it fades), so the table never tells how many were fired", () => {
    expect(MAX_SPENT_SHELLS).toBe(2);
    const { result } = renderHook(() => useShotAnimation());
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) {
      fire(result, i % 2 ? "blank" : "live");
      ids.push(result.current.spentShells[result.current.spentShells.length - 1].id);
    }

    const shells = result.current.spentShells;
    expect(shells).toHaveLength(2);
    expect(shells.map(s => s.id)).toEqual(ids.slice(-2));
    expect(shells[1].kind).toBe("live");
  });

  it("resetRecoilFlash clears recoil/flash but leaves the casings; resetForNewRound sweeps them too", () => {
    const { result } = renderHook(() => useShotAnimation());
    fire(result, "live");
    act(() => result.current.resetRecoilFlash());
    expect(result.current.recoil).toBe(false);
    expect(result.current.flash).toBe(false);
    expect(result.current.spentShells).toHaveLength(1);

    act(() => result.current.resetForNewRound());
    expect(result.current.spentShells).toEqual([]);
  });

  it("cancelling a shot mid-aim never fires it", () => {
    const { result } = renderHook(() => useShotAnimation());
    let cancel = () => {};
    act(() => {
      cancel = result.current.playShot(90, "live");
    });
    cancel();
    act(() => {
      vi.advanceTimersByTime(AIM_MS + SHOT_MS);
    });
    expect(result.current.fireStage).toBe("aiming");
    expect(result.current.spentShells).toEqual([]);
  });
});
