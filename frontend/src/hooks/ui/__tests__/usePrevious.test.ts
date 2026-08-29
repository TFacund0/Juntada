import { describe, test, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePrevious } from "../usePrevious";

describe("usePrevious", () => {
  test("returns undefined on first render", () => {
    const { result } = renderHook(() => usePrevious(1));
    expect(result.current).toBeUndefined();
  });

  test("returns the prior value after the value changes", () => {
    const { result, rerender } = renderHook(({ value }) => usePrevious(value), {
      initialProps: { value: 1 },
    });
    expect(result.current).toBeUndefined();

    rerender({ value: 2 });
    expect(result.current).toBe(1);

    rerender({ value: 3 });
    expect(result.current).toBe(2);
  });

  test("is safe under StrictMode double-invoke (still reports one render behind)", () => {
    const { result, rerender } = renderHook(({ value }) => usePrevious(value), {
      initialProps: { value: "a" },
      wrapper: ({ children }) => children as React.ReactElement,
    });
    rerender({ value: "b" });
    expect(result.current).toBe("a");
    rerender({ value: "c" });
    expect(result.current).toBe("b");
  });
});
