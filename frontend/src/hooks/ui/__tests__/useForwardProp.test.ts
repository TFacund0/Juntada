import { describe, test, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useForwardProp } from "../useForwardProp";

describe("useForwardProp", () => {
  test("fires cb(value) on value change", () => {
    const cb = vi.fn();
    const { rerender } = renderHook(({ value }) => useForwardProp(value, cb), {
      initialProps: { value: 1 },
    });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenLastCalledWith(1);

    rerender({ value: 2 });
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith(2);
  });

  test("re-fires when cb identity changes even if value is unchanged", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const { rerender } = renderHook(({ value, cb }) => useForwardProp(value, cb), {
      initialProps: { value: 1, cb: cb1 },
    });
    expect(cb1).toHaveBeenCalledTimes(1);

    rerender({ value: 1, cb: cb2 });
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb1).toHaveBeenCalledTimes(1);
  });

  test("does not fire when value and cb are unchanged across rerenders", () => {
    const cb = vi.fn();
    const { rerender } = renderHook(({ value }) => useForwardProp(value, cb), {
      initialProps: { value: 1 },
    });
    expect(cb).toHaveBeenCalledTimes(1);

    rerender({ value: 1 });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("clearOnUnmount: true emits cb(null) on unmount", () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useForwardProp<string | null>("x", cb, { clearOnUnmount: true }));
    expect(cb).toHaveBeenCalledWith("x");

    unmount();
    expect(cb).toHaveBeenLastCalledWith(null);
  });

  test("without clearOnUnmount, cb is not called again on unmount", () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useForwardProp("x", cb));
    expect(cb).toHaveBeenCalledTimes(1);

    unmount();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("tolerates an undefined cb", () => {
    expect(() => renderHook(() => useForwardProp(1, undefined))).not.toThrow();
  });

  test("sync: true still forwards value/clearOnUnmount the same way, just via useLayoutEffect", () => {
    const cb = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ value }) => useForwardProp<string | null>(value, cb, { sync: true, clearOnUnmount: true }),
      {
        initialProps: { value: "a" as string | null },
      },
    );
    expect(cb).toHaveBeenCalledWith("a");

    rerender({ value: "b" });
    expect(cb).toHaveBeenLastCalledWith("b");

    unmount();
    expect(cb).toHaveBeenLastCalledWith(null);
  });
});
