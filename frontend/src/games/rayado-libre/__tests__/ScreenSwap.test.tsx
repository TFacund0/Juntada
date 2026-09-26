import { afterEach, describe, expect, test, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ScreenSwap } from "../components/ScreenSwap";

afterEach(() => {
  // @ts-expect-error — jsdom no trae Web Animations; se agrega y se saca por test.
  delete HTMLElement.prototype.animate;
});

describe("ScreenSwap", () => {
  test("without Web Animations the new screen replaces the old one right away", () => {
    const { rerender } = render(<ScreenSwap screenKey="a">vieja</ScreenSwap>);
    rerender(<ScreenSwap screenKey="b">nueva</ScreenSwap>);
    expect(screen.getByText("nueva")).toBeInTheDocument();
    expect(screen.queryByText("vieja")).not.toBeInTheDocument();
  });

  test("with Web Animations the old screen stays while it leaves, then the new one comes in", () => {
    const outs: { onfinish: (() => void) | null }[] = [];
    const animate = vi.fn((keyframes: Keyframe[]) => {
      const anim = { onfinish: null as (() => void) | null, cancel: vi.fn() };
      // La salida termina en opacidad 0; la entrada arranca ahí.
      if (keyframes[1]?.opacity === 0) outs.push(anim);
      return anim as unknown as Animation;
    });
    HTMLElement.prototype.animate = animate;

    const { rerender } = render(<ScreenSwap screenKey="a">vieja</ScreenSwap>);
    rerender(<ScreenSwap screenKey="b">nueva</ScreenSwap>);
    expect(screen.getByText("vieja")).toBeInTheDocument();
    expect(outs).toHaveLength(1);

    act(() => outs[0].onfinish?.());
    expect(screen.getByText("nueva")).toBeInTheDocument();
    expect(screen.queryByText("vieja")).not.toBeInTheDocument();
    // La nueva entra desde abajo (translateY 14px), 300ms.
    expect(animate).toHaveBeenLastCalledWith(
      [expect.objectContaining({ transform: "translateY(14px)" }), expect.anything()],
      expect.objectContaining({ duration: 300 }),
    );
  });
});
