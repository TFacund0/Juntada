import { describe, test, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAppDialogs } from "./useAppDialogs";

describe("useAppDialogs", () => {
  test("all confirmation dialogs start closed", () => {
    const { result } = renderHook(() => useAppDialogs());
    expect(result.current.showExitConfirm).toBe(false);
    expect(result.current.showBackConfirm).toBe(false);
    expect(result.current.showLocalResetConfirm).toBe(false);
    expect(result.current.showReturnToGroupConfirm).toBe(false);
  });

  test.each([
    ["showExitConfirm", "setShowExitConfirm"],
    ["showBackConfirm", "setShowBackConfirm"],
    ["showLocalResetConfirm", "setShowLocalResetConfirm"],
    ["showReturnToGroupConfirm", "setShowReturnToGroupConfirm"],
  ] as const)("%s toggles independently via %s", (flag, setter) => {
    const { result } = renderHook(() => useAppDialogs());
    act(() => result.current[setter](true));
    expect(result.current[flag]).toBe(true);
    act(() => result.current[setter](false));
    expect(result.current[flag]).toBe(false);
  });
});
