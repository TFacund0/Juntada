import { describe, test, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAppDialogs } from "../useAppDialogs";

describe("useAppDialogs", () => {
  test("all confirmation dialogs start closed, kickedNotice starts null", () => {
    const { result } = renderHook(() => useAppDialogs());
    expect(result.current.showExitConfirm).toBe(false);
    expect(result.current.showBackConfirm).toBe(false);
    expect(result.current.showLocalResetConfirm).toBe(false);
    expect(result.current.showReturnToGroupConfirm).toBe(false);
    expect(result.current.kickedNotice).toBeNull();
  });

  test("setKickedNotice sets and clears the kicked message", () => {
    const { result } = renderHook(() => useAppDialogs());
    act(() => result.current.setKickedNotice("Fuiste expulsado del grupo"));
    expect(result.current.kickedNotice).toBe("Fuiste expulsado del grupo");
    act(() => result.current.setKickedNotice(null));
    expect(result.current.kickedNotice).toBeNull();
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
