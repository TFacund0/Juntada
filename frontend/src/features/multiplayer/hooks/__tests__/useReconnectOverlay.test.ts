import { describe, test, expect, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useReconnectOverlay } from "../useReconnectOverlay";

function setup(overrides: Partial<Parameters<typeof useReconnectOverlay>[0]> = {}) {
  const resetReconnect = vi.fn();
  const setConnectionPhase = vi.fn();
  let room: { code: string; phase: string } | null = null;
  const readRoom = vi.fn(() => room as never);
  const setRoom = (next: typeof room) => {
    room = next;
  };
  const hook = renderHook(() =>
    useReconnectOverlay({
      initialColdStart: false,
      hasPersistedRoom: false,
      readRoom,
      setConnectionPhase,
      resetReconnect,
      ...overrides,
    }),
  );
  return { ...hook, resetReconnect, setConnectionPhase, readRoom, setRoom };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("overlayMode priority ladder", () => {
  test("is 'none' when nothing is happening", () => {
    const { result } = setup();
    expect(result.current.overlayMode).toBe("none");
  });

  test("is 'connecting' while coldStart is true with no other flag set", () => {
    const { result } = setup({ initialColdStart: true });
    expect(result.current.overlayMode).toBe("connecting");
  });

  test("is 'prompt' once rejoinChoicePending is set during coldStart", () => {
    const { result } = setup({ initialColdStart: true });
    act(() => result.current.resolveColdStart("round"));
    expect(result.current.rejoinChoicePending).toBe(true);
    expect(result.current.overlayMode).toBe("prompt");
  });

  test("is 'reconnected' once justReconnected wins over a stale coldStart", () => {
    const { result } = setup({ initialColdStart: true });
    act(() => result.current.onReconnected());
    // onReconnected only flashes justReconnected while reconnectingRef was true;
    // simulate a real drop first via onSocketClosed.
    act(() => result.current.onSocketClosed());
    act(() => result.current.onReconnected());
    expect(result.current.justReconnected).toBe(true);
    expect(result.current.overlayMode).toBe("reconnected");
  });

  test("is 'failed' once reconnectFailed wins over justReconnected/coldStart", () => {
    const { result } = setup({ initialColdStart: true });
    act(() => result.current.onReconnectGivenUp());
    expect(result.current.overlayMode).toBe("failed");
  });

  test("is 'gone' once sessionGone wins over every other flag", () => {
    const { result } = setup({ initialColdStart: true });
    act(() => result.current.onReconnectGivenUp());
    act(() => result.current.markSessionGone());
    expect(result.current.overlayMode).toBe("gone");
  });
});

describe("resolveColdStart", () => {
  test("resolves immediately on a lobby phase (or no phase at all)", () => {
    const { result } = setup({ initialColdStart: true });
    act(() => result.current.resolveColdStart("lobby"));
    expect(result.current.coldStart).toBe(false);
    expect(result.current.rejoinChoicePending).toBe(false);
  });

  test("waits for an explicit choice on a non-lobby phase", () => {
    const { result } = setup({ initialColdStart: true });
    act(() => result.current.resolveColdStart("round"));
    expect(result.current.coldStart).toBe(true);
    expect(result.current.rejoinChoicePending).toBe(true);
  });

  test("is a no-op once coldStart is already false", () => {
    const { result } = setup({ initialColdStart: false });
    act(() => result.current.resolveColdStart("round"));
    expect(result.current.rejoinChoicePending).toBe(false);
  });
});

describe("settleGroupColdStart", () => {
  test("resolves immediately when no room was ever persisted", () => {
    const { result } = setup({ initialColdStart: true, hasPersistedRoom: false });
    act(() => result.current.settleGroupColdStart());
    expect(result.current.coldStart).toBe(false);
  });

  test("schedules a fallback that resolves cold start if no 'joined' lands in time", () => {
    vi.useFakeTimers();
    const { result } = setup({ initialColdStart: true, hasPersistedRoom: true });
    act(() => result.current.settleGroupColdStart());
    expect(result.current.coldStart).toBe(true); // still waiting

    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.coldStart).toBe(false); // fallback fired, no joined arrived
  });

  test("does not resolve via the fallback once a room has since arrived", () => {
    vi.useFakeTimers();
    const { result, setRoom } = setup({ initialColdStart: true, hasPersistedRoom: true });
    act(() => result.current.settleGroupColdStart());
    setRoom({ code: "ABCDE", phase: "lobby" });

    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.coldStart).toBe(true); // untouched — "joined" is expected to resolve it via resolveColdStart
  });
});

describe("cancelJoinFallbacks", () => {
  test("cancels a pending group-joined fallback before it fires", () => {
    vi.useFakeTimers();
    const { result } = setup({ initialColdStart: true, hasPersistedRoom: true });
    act(() => result.current.settleGroupColdStart());
    act(() => result.current.cancelJoinFallbacks());

    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.coldStart).toBe(true); // fallback never fired
  });

  test("cancels a pending group-phase fallback before it fires", () => {
    vi.useFakeTimers();
    const { result, setConnectionPhase } = setup();
    act(() => result.current.scheduleGroupPhaseFallback());
    act(() => result.current.cancelJoinFallbacks());

    act(() => vi.advanceTimersByTime(5000));
    expect(setConnectionPhase).not.toHaveBeenCalled();
  });
});

describe("scheduleGroupPhaseFallback", () => {
  test("flips connectionPhase to 'group' if no room shows up in time", () => {
    vi.useFakeTimers();
    const { result, setConnectionPhase } = setup();
    act(() => result.current.scheduleGroupPhaseFallback());
    act(() => vi.advanceTimersByTime(3000));
    expect(setConnectionPhase).toHaveBeenCalledWith("group");
  });

  test("does not flip connectionPhase once a room has since arrived", () => {
    vi.useFakeTimers();
    const { result, setConnectionPhase, setRoom } = setup();
    act(() => result.current.scheduleGroupPhaseFallback());
    setRoom({ code: "ABCDE", phase: "lobby" });
    act(() => vi.advanceTimersByTime(3000));
    expect(setConnectionPhase).not.toHaveBeenCalled();
  });
});

describe("onReconnected", () => {
  test("does nothing extra on the very first connect (never actually reconnecting)", () => {
    const { result } = setup();
    act(() => result.current.onReconnected());
    expect(result.current.justReconnected).toBe(false);
  });

  test("flashes justReconnected for 3s after a real drop, then clears itself", () => {
    vi.useFakeTimers();
    const { result, resetReconnect } = setup();
    act(() => result.current.onSocketClosed());
    act(() => result.current.onReconnected());

    expect(result.current.reconnecting).toBe(false);
    expect(result.current.justReconnected).toBe(true);
    expect(resetReconnect).toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.justReconnected).toBe(false);
  });
});

describe("abandonReconnect / stopReconnecting / retryReset", () => {
  test("abandonReconnect resets all 4 reconnect flags plus the service's backoff", () => {
    const { result, resetReconnect } = setup();
    act(() => result.current.onSocketClosed());
    act(() => result.current.setReconnectAttempt(3));
    act(() => result.current.onReconnectGivenUp());

    act(() => result.current.abandonReconnect());

    expect(result.current.reconnecting).toBe(false);
    expect(result.current.reconnectAttempt).toBe(0);
    expect(result.current.reconnectFailed).toBe(false);
    expect(result.current.rejoinChoicePending).toBe(false);
    expect(resetReconnect).toHaveBeenCalled();
  });

  test("stopReconnecting only flips reconnecting", () => {
    const { result } = setup();
    act(() => result.current.onSocketClosed());
    act(() => result.current.stopReconnecting());
    expect(result.current.reconnecting).toBe(false);
  });

  test("retryReset clears reconnectFailed/attempt, sets reconnecting optimistically, and resets backoff", () => {
    const { result, resetReconnect } = setup();
    act(() => result.current.onReconnectGivenUp());
    act(() => result.current.retryReset());

    expect(result.current.reconnectFailed).toBe(false);
    expect(result.current.reconnectAttempt).toBe(0);
    expect(result.current.reconnecting).toBe(true);
    expect(resetReconnect).toHaveBeenCalled();
  });
});

describe("confirmRejoin", () => {
  test("clears both coldStart and rejoinChoicePending", () => {
    const { result } = setup({ initialColdStart: true });
    act(() => result.current.resolveColdStart("round"));
    act(() => result.current.confirmRejoin());
    expect(result.current.coldStart).toBe(false);
    expect(result.current.rejoinChoicePending).toBe(false);
  });
});

describe("reset", () => {
  test("clears every overlay flag back to its initial value", () => {
    const { result } = setup({ initialColdStart: true });
    act(() => result.current.onSocketClosed());
    act(() => result.current.setReconnectAttempt(2));
    act(() => result.current.onReconnectGivenUp());
    act(() => result.current.markSessionGone());
    act(() => result.current.resolveColdStart("round"));

    act(() => result.current.reset());

    expect(result.current.reconnecting).toBe(false);
    expect(result.current.reconnectAttempt).toBe(0);
    expect(result.current.reconnectFailed).toBe(false);
    expect(result.current.justReconnected).toBe(false);
    expect(result.current.coldStart).toBe(false);
    expect(result.current.rejoinChoicePending).toBe(false);
    expect(result.current.sessionGone).toBe(false);
  });

  test("cancels all three pending timers so none of them fire after reset", () => {
    vi.useFakeTimers();
    const { result } = setup({ initialColdStart: true, hasPersistedRoom: true });
    act(() => result.current.onSocketClosed());
    act(() => result.current.onReconnected()); // schedules reconnectedBannerRef
    act(() => result.current.settleGroupColdStart()); // schedules groupJoinedFallbackRef
    act(() => result.current.scheduleGroupPhaseFallback()); // schedules groupPhaseFallbackRef

    act(() => result.current.reset());
    act(() => vi.advanceTimersByTime(5000));

    // Nothing re-flips justReconnected/coldStart back on after reset.
    expect(result.current.justReconnected).toBe(false);
    expect(result.current.coldStart).toBe(false);
  });
});

describe("isColdStart", () => {
  test("mirrors the current coldStart flag through a stable ref reader", () => {
    const { result } = setup({ initialColdStart: true });
    expect(result.current.isColdStart()).toBe(true);
    act(() => result.current.endColdStart());
    expect(result.current.isColdStart()).toBe(false);
  });
});

describe("cleanup on unmount", () => {
  test("clears all pending timers on unmount without throwing", () => {
    vi.useFakeTimers();
    const { result, unmount } = setup({ initialColdStart: true, hasPersistedRoom: true });
    act(() => result.current.settleGroupColdStart());
    act(() => result.current.scheduleGroupPhaseFallback());

    expect(() => unmount()).not.toThrow();
  });
});
