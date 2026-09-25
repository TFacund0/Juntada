import { afterEach, describe, expect, test, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { RESUME_GRACE_MS, canAnimateAt, useAnimationGate } from "../useAnimationGate";

describe("canAnimateAt", () => {
  test("never while the page is hidden", () => {
    expect(canAnimateAt(10_000, true, Number.NEGATIVE_INFINITY)).toBe(false);
  });

  test("not right after coming back (catching up), yes once the grace period passed", () => {
    expect(canAnimateAt(5_000 + RESUME_GRACE_MS - 1, false, 5_000)).toBe(false);
    expect(canAnimateAt(5_000 + RESUME_GRACE_MS, false, 5_000)).toBe(true);
  });
});

describe("useAnimationGate", () => {
  afterEach(() => vi.restoreAllMocks());

  test("animates from mount, then pauses briefly after the page becomes visible again", () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const { result } = renderHook(() => useAnimationGate());
    expect(result.current()).toBe(true);

    visibility.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(result.current()).toBe(false);

    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(result.current()).toBe(false);

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + RESUME_GRACE_MS + 1);
    expect(result.current()).toBe(true);
  });
});
