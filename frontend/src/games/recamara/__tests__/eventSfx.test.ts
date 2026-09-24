import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEventSfx, type PlayingSfxEvent } from "../hooks/eventSfx";
import type { FireStage } from "../hooks/shotAnimation";
import type { RecamaraSfx } from "../hooks/recamaraSfx";

function fakeSfx(): RecamaraSfx & { play: ReturnType<typeof vi.fn>; vibrate: ReturnType<typeof vi.fn> } {
  return { muted: false, toggleMuted: vi.fn(), play: vi.fn(), vibrate: vi.fn() };
}

function setup(initial: { event: PlayingSfxEvent | null; stage: FireStage }) {
  const sfx = fakeSfx();
  const hook = renderHook(({ event, stage }) => useEventSfx(event, stage, sfx), { initialProps: initial });
  const names = () => sfx.play.mock.calls.map(c => c[0]);
  return { sfx, names, rerender: hook.rerender };
}

const liveShot = (id: number, targetIsMe = false): PlayingSfxEvent => ({ id, kind: "shot", shellKind: "live", targetIsMe });

describe("useEventSfx", () => {
  it("nothing playing: silence", () => {
    const { sfx } = setup({ event: null, stage: "idle" });
    expect(sfx.play).not.toHaveBeenCalled();
    expect(sfx.vibrate).not.toHaveBeenCalled();
  });

  it("a shot: heartbeat while aiming, then bang + rack + casing clinks on the trigger", () => {
    const { names, rerender } = setup({ event: liveShot(1), stage: "aiming" });
    expect(names()).toEqual(["thump", "thump", "thump"]);

    rerender({ event: liveShot(1), stage: "firing" });
    expect(names().slice(3)).toEqual(["bang", "rack", "clink", "clink"]);
  });

  it("a blank clicks instead of banging", () => {
    const { names, rerender } = setup({ event: { id: 1, kind: "shot", shellKind: "blank" }, stage: "aiming" });
    rerender({ event: { id: 1, kind: "shot", shellKind: "blank" }, stage: "firing" });
    expect(names()).toContain("click");
    expect(names()).not.toContain("bang");
  });

  it("re-renders of the same shot never replay its sounds", () => {
    const { sfx, rerender } = setup({ event: liveShot(1), stage: "aiming" });
    rerender({ event: liveShot(1), stage: "firing" });
    const count = sfx.play.mock.calls.length;
    rerender({ event: liveShot(1), stage: "firing" });
    rerender({ event: liveShot(1), stage: "result" });
    expect(sfx.play.mock.calls.length).toBe(count);
  });

  it("a second queued shot gets its own full set of sounds", () => {
    const { names, rerender } = setup({ event: liveShot(1), stage: "aiming" });
    rerender({ event: liveShot(1), stage: "firing" });
    rerender({ event: liveShot(1), stage: "result" });
    rerender({ event: liveShot(2), stage: "aiming" });
    rerender({ event: liveShot(2), stage: "firing" });
    expect(names().filter(n => n === "bang")).toHaveLength(2);
    expect(names().filter(n => n === "thump")).toHaveLength(6);
  });

  it("vibrates hard only when the shot is aimed at me; a live hit on someone else is a short buzz", () => {
    const mine = setup({ event: liveShot(1, true), stage: "aiming" });
    expect(mine.sfx.vibrate).toHaveBeenCalledWith([15, 480, 15, 430, 15]);
    mine.rerender({ event: liveShot(1, true), stage: "firing" });
    expect(mine.sfx.vibrate).toHaveBeenLastCalledWith([90, 40, 200]);

    const other = setup({ event: liveShot(1), stage: "aiming" });
    expect(other.sfx.vibrate).not.toHaveBeenCalled();
    other.rerender({ event: liveShot(1), stage: "firing" });
    expect(other.sfx.vibrate).toHaveBeenCalledWith(60);
  });

  it("items play their own sound, falling back to a pop", () => {
    const saw = setup({ event: { id: 1, kind: "item", item: "🪚" }, stage: "idle" });
    expect(saw.names()).toEqual(["saw"]);
    const cuffs = setup({ event: { id: 1, kind: "item", item: "🔒" }, stage: "idle" });
    expect(cuffs.names()).toEqual(["pop"]);
  });
});
