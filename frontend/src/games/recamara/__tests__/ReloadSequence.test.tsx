import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { ReloadSequence } from "../components/ReloadSequence";
import type { RecamaraSfx } from "../hooks/recamaraSfx";
import { RELOAD_FLIP_MS, RELOAD_HOLD_MS, RELOAD_SHELL_IN_MS, RELOAD_SHELL_LOAD_MS, RELOAD_SHUFFLE_MS } from "../utils/timing";

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

  it("spells out the count once the shells are in, asks to memorize them while they're face-up, and reports done exactly once", () => {
    const onDone = vi.fn();
    const { container } = render(<ReloadSequence liveCount={1} blankCount={2} onDone={onDone} />);
    expect(container.querySelector(".reload-legend")).toBeEmptyDOMElement();
    advance(RELOAD_SHELL_IN_MS * 3);
    expect(container.querySelector(".reload-legend")).toHaveTextContent("1 real · 2 falsas");
    expect(container.querySelector(".reload-hint")).toHaveTextContent("Memorizá. El orden va a ser secreto.");
    advance(RELOAD_HOLD_MS);
    expect(container.querySelector(".reload-hint")).toBeEmptyDOMElement();
    expect(onDone).not.toHaveBeenCalled();
    advance(RELOAD_FLIP_MS + RELOAD_SHUFFLE_MS + RELOAD_SHELL_LOAD_MS * 3);
    expect(onDone).toHaveBeenCalledTimes(1);
    advance(10000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("waits delayMs before the first shell", () => {
    const { container } = render(<ReloadSequence liveCount={1} blankCount={1} delayMs={500} />);
    advance(499);
    expect(container.querySelectorAll(".reload-shell.in")).toHaveLength(0);
    advance(1);
    expect(container.querySelectorAll(".reload-shell.in")).toHaveLength(1);
  });

  it("with reduced motion it just shows the shells face-up for the hold, then is done: no flip, no shuffle, no sound", () => {
    mockReducedMotion(true);
    const sfx = fakeSfx();
    const onDone = vi.fn();
    const { container } = render(<ReloadSequence liveCount={2} blankCount={2} sfx={sfx} onDone={onDone} />);
    expect(row(container)).toHaveClass("phase-hold");
    expect(container.querySelectorAll(".reload-shell.in")).toHaveLength(4);
    expect(container.querySelectorAll(".shell-icon.hidden")).toHaveLength(0);
    advance(RELOAD_HOLD_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(sfx.play).not.toHaveBeenCalled();
  });
});
