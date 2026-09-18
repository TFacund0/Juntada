import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useShotAnimation } from "../hooks/shotAnimation";

describe("useShotAnimation", () => {
  it("clears lastShell and recoil/flash on resetRecoilFlash and resetForNewRound", () => {
    const { result } = renderHook(() => useShotAnimation());

    // Initially idle, no shell
    expect(result.current.fireStage).toBe("idle");
    expect(result.current.lastShell).toBeNull();

    // Trigger resetRecoilFlash
    act(() => {
      result.current.resetRecoilFlash();
    });

    expect(result.current.lastShell).toBeNull();
    expect(result.current.recoil).toBe(false);
    expect(result.current.flash).toBe(false);

    // Trigger resetForNewRound
    act(() => {
      result.current.resetForNewRound();
    });

    expect(result.current.lastShell).toBeNull();
  });
});
