import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useGameAudio } from "../useGameAudio";

// The unlock/resume behavior itself is covered through recamara's
// useRecamaraSfx tests (a thin wrapper over this hook); here, what's
// specific to the generic version: the per-game storage key and `play`.
class FakeAudioContext {
  state = "running";
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {});
}

describe("useGameAudio", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("AudioContext", FakeAudioContext);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("remembers the mute choice under each game's own key", () => {
    const { result } = renderHook(() => useGameAudio("test:game-a:muted"));
    act(() => result.current.toggleMuted());
    expect(localStorage.getItem("test:game-a:muted")).toBe("1");
    expect(renderHook(() => useGameAudio("test:game-a:muted")).result.current.muted).toBe(true);
    expect(renderHook(() => useGameAudio("test:game-b:muted")).result.current.muted).toBe(false);
  });

  it("play hands the shared context to the game's synth, and not while muted", () => {
    const run = vi.fn();
    const { result } = renderHook(() => useGameAudio("test:game-a:muted"));
    result.current.play(run);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toBeInstanceOf(FakeAudioContext);

    act(() => result.current.toggleMuted());
    result.current.play(run);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("a synth that throws never breaks the game", () => {
    const { result } = renderHook(() => useGameAudio("test:game-a:muted"));
    expect(() =>
      result.current.play(() => {
        throw new Error("boom");
      }),
    ).not.toThrow();
  });
});
