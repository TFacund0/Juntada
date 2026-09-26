import { beforeEach, describe, expect, test, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMyGuessCelebration, type LastGuess } from "../hooks/useMyGuessCelebration";

const fx = { inkSplash: vi.fn(), floatPoints: vi.fn(), bigFlash: vi.fn(), confetti: vi.fn() };
vi.mock("../hooks/useFxLayer", () => ({ useFxLayer: () => fx }));

function setup(initial?: LastGuess) {
  const sfx = { play: vi.fn(), vibrate: vi.fn() };
  const hook = renderHook(({ lastGuess }: { lastGuess?: LastGuess }) => useMyGuessCelebration(lastGuess, sfx), {
    initialProps: { lastGuess: initial },
  });
  return { sfx, ...hook };
}

beforeEach(() => vi.clearAllMocks());

describe("useMyGuessCelebration", () => {
  test("a new guess of mine: giant '¡Adivinaste!', rainbow splash, 40 confetti, arpeggio and [30,40,80]", () => {
    const { sfx, rerender } = setup();
    rerender({ lastGuess: { playerId: "me", points: 57, guessId: 3 } });
    expect(fx.bigFlash).toHaveBeenCalledWith("¡Adivinaste!", "+57 puntos");
    expect(fx.inkSplash).toHaveBeenCalledWith(expect.any(String), expect.any(Number), expect.any(Number), true);
    expect(fx.confetti).toHaveBeenCalledWith(40);
    expect(sfx.play).toHaveBeenCalledWith("youOk");
    expect(sfx.vibrate).toHaveBeenCalledWith([30, 40, 80]);
  });

  test("once per guessId: the private view arriving again doesn't replay it", () => {
    const { rerender } = setup();
    rerender({ lastGuess: { playerId: "me", points: 57, guessId: 3 } });
    rerender({ lastGuess: { playerId: "me", points: 57, guessId: 3 } });
    expect(fx.bigFlash).toHaveBeenCalledTimes(1);
  });

  test("a guess already there on mount (reconnecting) is not celebrated", () => {
    setup({ playerId: "me", points: 57, guessId: 3 });
    expect(fx.bigFlash).not.toHaveBeenCalled();
  });
});
