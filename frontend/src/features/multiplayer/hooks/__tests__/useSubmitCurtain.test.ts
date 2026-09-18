import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSubmitCurtain } from "../useSubmitCurtain";

describe("useSubmitCurtain", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("armSubmitTimeout surfaces an error and clears submitting after 8s with no response", () => {
    const setError = vi.fn();
    const { result, rerender } = renderHook(({ connectionPhase }) => useSubmitCurtain({ connectionPhase, setError }), {
      initialProps: { connectionPhase: "menu" },
    });

    result.current.setSubmitting(true);
    rerender({ connectionPhase: "menu" });
    result.current.armSubmitTimeout("No se pudo crear la partida — probá de nuevo");
    vi.advanceTimersByTime(8000);

    expect(setError).toHaveBeenCalledWith("No se pudo crear la partida — probá de nuevo");
  });

  test("submitting clears automatically once connectionPhase leaves menu/create/join", () => {
    const setError = vi.fn();
    const onTransitionSettled = vi.fn();
    const { result, rerender } = renderHook(({ connectionPhase }) => useSubmitCurtain({ connectionPhase, setError, onTransitionSettled }), {
      initialProps: { connectionPhase: "join" },
    });

    result.current.setSubmitting(true);
    rerender({ connectionPhase: "lobby" });

    expect(onTransitionSettled).toHaveBeenCalled();
    expect(result.current.submitting).toBe(false);
  });

  test("settle() calls onTransitionSettled, clears submitting, and has a stable identity", () => {
    const setError = vi.fn();
    const onTransitionSettled = vi.fn();
    const { result, rerender } = renderHook(({ connectionPhase }) => useSubmitCurtain({ connectionPhase, setError, onTransitionSettled }), {
      initialProps: { connectionPhase: "menu" },
    });

    const firstSettle = result.current.settle;
    result.current.setSubmitting(true);
    rerender({ connectionPhase: "menu" });

    expect(result.current.settle).toBe(firstSettle);

    result.current.settle();
    expect(onTransitionSettled).toHaveBeenCalled();
  });

  test("settle() clears a pending armSubmitTimeout so it does not also fire", () => {
    const setError = vi.fn();
    const { result, rerender } = renderHook(({ connectionPhase }) => useSubmitCurtain({ connectionPhase, setError }), {
      initialProps: { connectionPhase: "menu" },
    });

    result.current.armSubmitTimeout("boom");
    rerender({ connectionPhase: "menu" });
    result.current.settle();
    vi.advanceTimersByTime(8000);

    expect(setError).not.toHaveBeenCalled();
  });
});
