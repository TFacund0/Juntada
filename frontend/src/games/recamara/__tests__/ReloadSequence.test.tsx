import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { ReloadSequence } from "../components/ReloadSequence";
import type { RecamaraSfx } from "../hooks/recamaraSfx";
import {
  RELOAD_FLIP_MS,
  RELOAD_HOLD_MS,
  RELOAD_SHELL_IN_MS,
  RELOAD_SHELL_LOAD_MS,
  RELOAD_SHUFFLE_MS,
  ROUND_INTRO_MS,
} from "../utils/timing";

function fakeSfx() {
  return { muted: false, toggleMuted: vi.fn(), play: vi.fn(), vibrate: vi.fn() } satisfies RecamaraSfx;
}

function mockReducedMotion(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
}

const row = (container: HTMLElement) => container.querySelector(".reload-row")!;
const shells = (container: HTMLElement) => Array.from(container.querySelectorAll(".reload-shell"));
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe("ReloadSequence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockReducedMotion(false);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders one shell per cartridge from the start (count is public), reals first, all face-up", () => {
    const { container } = render(<ReloadSequence liveCount={2} blankCount={3} />);
    expect(shells(container)).toHaveLength(5);
    const kinds = shells(container).map(s => s.querySelector(".shell-icon")!.getAttribute("class"));
    expect(kinds.map(k => (k!.includes("live") ? "live" : k!.includes("blank") ? "blank" : "hidden"))).toEqual([
      "live",
      "live",
      "blank",
      "blank",
      "blank",
    ]);
  });

  it("pops the shells in one by one, holds, flips them face-down, shuffles, then loads them one by one", () => {
    const sfx = fakeSfx();
    const { container } = render(<ReloadSequence liveCount={1} blankCount={2} sfx={sfx} />);
    expect(row(container)).toHaveClass("phase-in");

    advance(0);
    expect(container.querySelectorAll(".reload-shell.in")).toHaveLength(1);
    advance(RELOAD_SHELL_IN_MS * 2);
    expect(container.querySelectorAll(".reload-shell.in")).toHaveLength(3);
    expect(sfx.play.mock.calls.filter(c => c[0] === "pop")).toHaveLength(3);

    advance(RELOAD_SHELL_IN_MS);
    expect(row(container)).toHaveClass("phase-hold");

    advance(RELOAD_HOLD_MS);
    expect(row(container)).toHaveClass("phase-flip");
    // Face-down from here on: the order they end up in is never shown.
    expect(container.querySelectorAll(".shell-icon.hidden")).toHaveLength(3);

    advance(RELOAD_FLIP_MS);
    expect(row(container)).toHaveClass("phase-shuffle");

    advance(RELOAD_SHUFFLE_MS);
    expect(row(container)).toHaveClass("phase-load");
    advance(RELOAD_SHELL_LOAD_MS * 3);
    expect(container.querySelectorAll(".reload-shell.loaded")).toHaveLength(3);
    expect(row(container)).toHaveClass("phase-done");
    expect(sfx.play).toHaveBeenLastCalledWith("rack");
  });

  it("a full 8-shell chamber finishes before the chamber card moves on by itself", () => {
    const { container } = render(<ReloadSequence liveCount={4} blankCount={4} />);
    advance(ROUND_INTRO_MS - 1);
    expect(row(container)).toHaveClass("phase-done");
  });

  it("with reduced motion it just shows the shells face-up: no flip, no shuffle, no timers", () => {
    mockReducedMotion(true);
    const sfx = fakeSfx();
    const { container } = render(<ReloadSequence liveCount={2} blankCount={2} sfx={sfx} />);
    expect(row(container)).toHaveClass("phase-hold");
    expect(container.querySelectorAll(".reload-shell.in")).toHaveLength(4);
    advance(ROUND_INTRO_MS);
    expect(row(container)).toHaveClass("phase-hold");
    expect(container.querySelectorAll(".shell-icon.hidden")).toHaveLength(0);
    expect(sfx.play).not.toHaveBeenCalled();
  });
});
