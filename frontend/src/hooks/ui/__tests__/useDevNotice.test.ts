import { describe, test, expect, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDevNotice } from "./useDevNotice";

const KEY = "impostorgame:devNoticeSeen";

afterEach(() => {
  localStorage.clear();
});

describe("useDevNotice", () => {
  test("shows the notice when the flag is absent", () => {
    const { result } = renderHook(() => useDevNotice());
    expect(result.current.showDevNotice).toBe(true);
  });

  test("hides the notice when the flag is pre-seeded", () => {
    localStorage.setItem(KEY, "1");
    const { result } = renderHook(() => useDevNotice());
    expect(result.current.showDevNotice).toBe(false);
  });

  test("dismissDevNotice persists the flag and hides the notice", () => {
    const { result } = renderHook(() => useDevNotice());
    act(() => result.current.dismissDevNotice());
    expect(result.current.showDevNotice).toBe(false);
    expect(localStorage.getItem(KEY)).toBe("1");
  });
});
