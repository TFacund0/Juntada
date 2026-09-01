import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePendingActionRetry } from "../usePendingActionRetry";

describe("usePendingActionRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("perform calls send with the payload", () => {
    const send = vi.fn();
    const onTimeout = vi.fn();
    const { result } = renderHook(() => usePendingActionRetry<string>({ justReconnected: false, settled: false, send, onTimeout }));

    result.current.perform("ROOM1");

    expect(send).toHaveBeenCalledWith("ROOM1");
  });

  test("safety timeout clears pending and calls onTimeout after 8s with no response", () => {
    const send = vi.fn();
    const onTimeout = vi.fn();
    const { result } = renderHook(() => usePendingActionRetry<string>({ justReconnected: false, settled: false, send, onTimeout }));

    result.current.perform("ROOM1");
    vi.advanceTimersByTime(8000);

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  test("pending clears once settled turns true", () => {
    const send = vi.fn();
    const onTimeout = vi.fn();
    const { result, rerender } = renderHook(
      ({ settled }) => usePendingActionRetry<string>({ justReconnected: false, settled, send, onTimeout }),
      { initialProps: { settled: false } },
    );

    result.current.perform("ROOM1");
    rerender({ settled: true });

    expect(result.current.pending).toBeNull();
  });

  test("resends the pending payload on reconnect while still unsettled", () => {
    const send = vi.fn();
    const onTimeout = vi.fn();
    const { result, rerender } = renderHook(
      ({ justReconnected }) => usePendingActionRetry<string>({ justReconnected, settled: false, send, onTimeout }),
      { initialProps: { justReconnected: false } },
    );

    result.current.perform("ROOM1");
    send.mockClear();
    rerender({ justReconnected: true });

    expect(send).toHaveBeenCalledWith("ROOM1");
  });

  test("does not resend on reconnect once already settled", () => {
    const send = vi.fn();
    const onTimeout = vi.fn();
    const { result, rerender } = renderHook(
      ({ justReconnected, settled }) => usePendingActionRetry<string>({ justReconnected, settled, send, onTimeout }),
      { initialProps: { justReconnected: false, settled: false } },
    );

    result.current.perform("ROOM1");
    rerender({ justReconnected: false, settled: true });
    send.mockClear();
    rerender({ justReconnected: true, settled: true });

    expect(send).not.toHaveBeenCalled();
  });
});
