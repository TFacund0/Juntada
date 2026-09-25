import { describe, expect, it, vi } from "vitest";
import { playRayadoSfx, RAYADO_SFX_NAMES } from "../utils/sfx";

// jsdom has no Web Audio, so this stands in for just enough of it to check
// every sound schedules real nodes, starts at the right time and ends up
// wired to the speakers (same approach as recamara's sfx.test.ts).
function fakeContext() {
  const started: number[] = [];
  const connectedToDestination: unknown[] = [];
  const destination = {};
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() });
  const node = () => {
    const n = {
      frequency: param(),
      gain: param(),
      Q: param(),
      type: "",
      buffer: null as unknown,
      connect: (target: unknown) => {
        if (target === destination) connectedToDestination.push(n);
        return target;
      },
      start: (t: number) => started.push(t),
      stop: vi.fn(),
    };
    return n;
  };
  const ctx = {
    currentTime: 10,
    sampleRate: 8000,
    destination,
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    createBufferSource: node,
    createOscillator: node,
    createGain: node,
    createBiquadFilter: node,
  };
  return { ctx: ctx as unknown as AudioContext, started, connectedToDestination };
}

describe("playRayadoSfx", () => {
  it.each(RAYADO_SFX_NAMES)("%s schedules sound that reaches the speakers", name => {
    const { ctx, started, connectedToDestination } = fakeContext();
    expect(() => playRayadoSfx(ctx, name)).not.toThrow();
    expect(started.length).toBeGreaterThan(0);
    expect(connectedToDestination.length).toBeGreaterThan(0);
  });

  it("delays are relative to the context's current time", () => {
    const { ctx, started } = fakeContext();
    playRayadoSfx(ctx, "beat", 0.5);
    expect(started).toEqual([10.5]);
  });

  it("the clock jump is a single descending sweep", () => {
    const { ctx, started } = fakeContext();
    playRayadoSfx(ctx, "jump");
    expect(started).toEqual([10]);
  });
});
