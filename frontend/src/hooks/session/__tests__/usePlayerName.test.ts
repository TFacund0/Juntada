import { describe, test, expect, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePlayerName } from "../usePlayerName";

const KEY = "impostorgame:playerName";

afterEach(() => {
  localStorage.clear();
});

describe("usePlayerName", () => {
  test("seeds an empty string when nothing is stored", () => {
    const { result } = renderHook(() => usePlayerName());
    expect(result.current.playerName).toBe("");
  });

  test("seeds the stored value on mount", () => {
    localStorage.setItem(KEY, "Tobi");
    const { result } = renderHook(() => usePlayerName());
    expect(result.current.playerName).toBe("Tobi");
  });

  test("savePlayerName trims, persists, and updates state", () => {
    const { result } = renderHook(() => usePlayerName());
    act(() => result.current.savePlayerName("  Tobi  "));
    expect(result.current.playerName).toBe("Tobi");
    expect(localStorage.getItem(KEY)).toBe("Tobi");
  });

  test("savePlayerName with whitespace-only input is a no-op", () => {
    const { result } = renderHook(() => usePlayerName());
    act(() => result.current.savePlayerName("   "));
    expect(result.current.playerName).toBe("");
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
