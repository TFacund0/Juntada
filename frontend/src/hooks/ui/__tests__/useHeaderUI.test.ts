import { describe, test, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useHeaderUI } from "../useHeaderUI";

describe("useHeaderUI", () => {
  test("profile menu and rules toggles start closed", () => {
    const { result } = renderHook(() => useHeaderUI());
    expect(result.current.showProfileMenu).toBe(false);
    expect(result.current.showRules).toBe(false);
  });

  test("setShowProfileMenu toggles independently of setShowRules", () => {
    const { result } = renderHook(() => useHeaderUI());
    act(() => result.current.setShowProfileMenu(true));
    expect(result.current.showProfileMenu).toBe(true);
    expect(result.current.showRules).toBe(false);
  });

  test("setShowRules toggles independently of setShowProfileMenu", () => {
    const { result } = renderHook(() => useHeaderUI());
    act(() => result.current.setShowRules(true));
    expect(result.current.showRules).toBe(true);
    expect(result.current.showProfileMenu).toBe(false);
  });

  test("closes the profile menu on an outside click", () => {
    const { result } = renderHook(() => useHeaderUI());
    act(() => {
      const el = document.createElement("div");
      document.body.appendChild(el);
      (result.current.profileMenuRef as { current: HTMLDivElement | null }).current = el;
    });
    act(() => result.current.setShowProfileMenu(true));
    expect(result.current.showProfileMenu).toBe(true);

    act(() => {
      document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(result.current.showProfileMenu).toBe(false);
  });
});
