import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

vi.mock("../utils/sfx", () => ({ playSfx: vi.fn() }));

import { playSfx } from "../utils/sfx";
import { useRecamaraSfx } from "../hooks/recamaraSfx";

const KEY = "impostorgame:recamara:muted";

class FakeAudioContext {
  static created = 0;
  constructor() {
    FakeAudioContext.created += 1;
  }
  state = "suspended";
  resume = vi.fn(async () => {
    this.state = "running";
  });
  close = vi.fn(async () => {});
}

describe("useRecamaraSfx", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(playSfx).mockClear();
    FakeAudioContext.created = 0;
    vi.stubGlobal("AudioContext", FakeAudioContext);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("starts unmuted and plays through a lazily created, resumed audio context", () => {
    const { result } = renderHook(() => useRecamaraSfx());
    expect(result.current.muted).toBe(false);

    result.current.play("bang", 0.2);
    expect(playSfx).toHaveBeenCalledTimes(1);
    const [ctx, name, delay] = vi.mocked(playSfx).mock.calls[0];
    expect(ctx).toBeInstanceOf(FakeAudioContext);
    expect((ctx as unknown as FakeAudioContext).resume).toHaveBeenCalled();
    expect([name, delay]).toEqual(["bang", 0.2]);
  });

  it("muting silences play and is remembered for next time", () => {
    const { result, unmount } = renderHook(() => useRecamaraSfx());
    act(() => result.current.toggleMuted());
    expect(result.current.muted).toBe(true);
    expect(localStorage.getItem(KEY)).toBe("1");

    result.current.play("bang");
    expect(playSfx).not.toHaveBeenCalled();
    unmount();

    expect(renderHook(() => useRecamaraSfx()).result.current.muted).toBe(true);
  });

  it("falls back to unmuted when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useRecamaraSfx());
    expect(result.current.muted).toBe(false);
    expect(() => act(() => result.current.toggleMuted())).not.toThrow();
    expect(result.current.muted).toBe(true);
  });

  it("does nothing (and never throws) without Web Audio", () => {
    vi.stubGlobal("AudioContext", undefined);
    const { result } = renderHook(() => useRecamaraSfx());
    expect(() => result.current.play("bang")).not.toThrow();
    expect(playSfx).not.toHaveBeenCalled();
  });

  it("vibrate uses navigator.vibrate when present and ignores it when not", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, vibrate });
    const { result } = renderHook(() => useRecamaraSfx());
    result.current.vibrate([90, 40, 200]);
    expect(vibrate).toHaveBeenCalledWith([90, 40, 200]);

    vi.stubGlobal("navigator", { ...navigator, vibrate: undefined });
    expect(() => result.current.vibrate(60)).not.toThrow();
  });

  it("a first tap anywhere unlocks audio ahead of the first sound, and later sounds reuse that context", () => {
    const { result } = renderHook(() => useRecamaraSfx());
    expect(FakeAudioContext.created).toBe(0);

    window.dispatchEvent(new Event("touchend"));
    expect(FakeAudioContext.created).toBe(1);
    expect(playSfx).not.toHaveBeenCalled();

    result.current.play("click");
    expect(FakeAudioContext.created).toBe(1);
    expect(playSfx).toHaveBeenCalledTimes(1);
  });

  it("on a touch screen, pointerdown isn't a gesture: it doesn't use up the unlock", () => {
    renderHook(() => useRecamaraSfx());
    window.dispatchEvent(new Event("pointerdown"));
    expect(FakeAudioContext.created).toBe(0);
    window.dispatchEvent(new Event("pointerup"));
    expect(FakeAudioContext.created).toBe(1);
  });

  it("keeps trying on every tap while the browser still refuses to resume, then stops", async () => {
    let refuse = true;
    const resume = vi.fn(async function (this: FakeAudioContext) {
      if (!refuse) this.state = "running";
    });
    class StubbornContext extends FakeAudioContext {
      resume = resume;
    }
    vi.stubGlobal("AudioContext", StubbornContext);
    renderHook(() => useRecamaraSfx());

    window.dispatchEvent(new Event("click"));
    window.dispatchEvent(new Event("click"));
    await Promise.resolve();
    expect(resume).toHaveBeenCalledTimes(2);

    refuse = false;
    window.dispatchEvent(new Event("click")); // resumes now
    await Promise.resolve();
    window.dispatchEvent(new Event("click")); // running: this one stops listening
    window.dispatchEvent(new Event("click"));
    expect(resume).toHaveBeenCalledTimes(3);
    expect(FakeAudioContext.created).toBe(1);
  });

  it("asks iOS to play through the ringer switch", () => {
    const audioSession = { type: "auto" };
    vi.stubGlobal("navigator", { ...navigator, audioSession });
    renderHook(() => useRecamaraSfx());
    window.dispatchEvent(new Event("click"));
    expect(audioSession.type).toBe("playback");
  });
});
