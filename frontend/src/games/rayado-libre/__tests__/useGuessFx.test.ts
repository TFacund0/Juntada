import { afterEach, describe, expect, test, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useGuessFx } from "../hooks/useGuessFx";
import type { GuessEvent } from "../utils/guessEvents";

function setup({ iAmDrawer = false, otherSound = false, canAnimate = (): boolean => true, initial = [] as GuessEvent[] } = {}) {
  const root = document.createElement("div");
  root.innerHTML = '<div class="rl-circular-timer"></div><p data-fx-anchor="1"></p><p data-fx-anchor="2"></p>';
  document.body.appendChild(root);
  const sfx = { play: vi.fn(), vibrate: vi.fn() };
  const fx = { inkSplash: vi.fn(), floatPoints: vi.fn(), bigFlash: vi.fn(), confetti: vi.fn() };
  const hook = renderHook(
    ({ guesses }: { guesses: GuessEvent[] }) =>
      useGuessFx({ guesses, iAmDrawer, rootRef: { current: root }, sfx, fx, canAnimate, otherSound }),
    { initialProps: { guesses: initial } },
  );
  return { sfx, fx, ...hook };
}

const other: GuessEvent = { key: "1", color: "#f00", points: 60, mine: false };
const mine: GuessEvent = { key: "2", color: "#0f0", points: 45, mine: true };

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useGuessFx", () => {
  test("guesses already there on mount are not celebrated", () => {
    const { sfx, fx } = setup({ initial: [other] });
    expect(sfx.vibrate).not.toHaveBeenCalled();
    expect(fx.inkSplash).not.toHaveBeenCalled();
  });

  test("someone else's guess: splash by their line, points fly to the clock, short buzz", () => {
    const { sfx, fx, rerender } = setup({ otherSound: true });
    rerender({ guesses: [other] });
    expect(sfx.play).toHaveBeenCalledWith("otherOk");
    expect(sfx.vibrate).toHaveBeenCalledWith(20);
    expect(fx.inkSplash).toHaveBeenCalledWith("#f00", expect.any(Number), expect.any(Number));
    expect(fx.floatPoints).toHaveBeenCalledWith("+60", expect.anything(), expect.anything());
    expect(fx.bigFlash).not.toHaveBeenCalled();
  });

  test("when I'm the drawer, someone else's guess reads '+10 para vos'", () => {
    const { fx, rerender } = setup({ iAmDrawer: true });
    rerender({ guesses: [other] });
    expect(fx.floatPoints).toHaveBeenCalledWith("+10 para vos", expect.anything(), expect.anything());
  });

  test("my own guess: my line splashes and my points fly to the clock (the big celebration is useMyGuessCelebration)", () => {
    const { sfx, fx, rerender } = setup();
    rerender({ guesses: [mine] });
    expect(fx.inkSplash).toHaveBeenCalledWith("#0f0", expect.any(Number), expect.any(Number));
    expect(fx.floatPoints).toHaveBeenCalledWith("+45", expect.anything(), expect.anything());
    expect(fx.bigFlash).not.toHaveBeenCalled();
    expect(sfx.vibrate).not.toHaveBeenCalled();
  });

  test("a guess that arrives with the tab hidden (or just back) is shown, not celebrated", () => {
    const { sfx, fx, rerender } = setup({ canAnimate: () => false, otherSound: true });
    rerender({ guesses: [other] });
    expect(fx.inkSplash).not.toHaveBeenCalled();
    expect(sfx.play).not.toHaveBeenCalled();
  });
});
