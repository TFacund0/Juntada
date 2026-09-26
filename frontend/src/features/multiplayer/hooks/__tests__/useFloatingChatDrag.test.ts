import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { useFloatingChatDrag } from "../useFloatingChatDrag";

// jsdom doesn't implement setPointerCapture/releasePointerCapture, and
// getBoundingClientRect always returns a zero rect, so both need explicit
// stubs or the drag math would just compare 0 to 0 for the wrong reason.

function TestComponent({ onTap }: { onTap: () => void }) {
  const { bubbleRef, bubbleStyle, onPointerDown, onPointerMove, onPointerUp } = useFloatingChatDrag({ onTap });
  return createElement("button", {
    ref: bubbleRef,
    "data-testid": "bubble",
    style: bubbleStyle,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  });
}

function stubPointerCapture(el: HTMLElement) {
  Object.assign(el, {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
  });
}

function pointerEvent(type: string, opts: { clientX: number; clientY: number; pointerId?: number }) {
  return new PointerEvent(type, { clientX: opts.clientX, clientY: opts.clientY, pointerId: opts.pointerId ?? 1, bubbles: true });
}

beforeEach(() => {
  vi.stubGlobal("innerWidth", 1200);
  vi.stubGlobal("innerHeight", 800);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useFloatingChatDrag", () => {
  test("1. no drag yet -> bubbleStyle is the default right/bottom position", () => {
    const { getByTestId } = render(createElement(TestComponent, { onTap: vi.fn() }));
    const bubble = getByTestId("bubble");
    expect(bubble.style.right).toBe("18px");
    expect(bubble.style.bottom).toBe("var(--jt-chat-bubble-bottom, 96px)");
    expect(bubble.style.left).toBe("");
  });

  test("2. down -> move beyond threshold -> bubbleStyle switches to left/top with right/bottom auto", () => {
    const { getByTestId } = render(createElement(TestComponent, { onTap: vi.fn() }));
    const bubble = getByTestId("bubble");
    stubPointerCapture(bubble);
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ left: 100, top: 100 } as DOMRect);

    act(() => {
      bubble.dispatchEvent(pointerEvent("pointerdown", { clientX: 100, clientY: 100 }));
      bubble.dispatchEvent(pointerEvent("pointermove", { clientX: 120, clientY: 130 }));
    });

    expect(bubble.style.left).not.toBe("");
    expect(bubble.style.top).not.toBe("");
    expect(bubble.style.right).toBe("auto");
    expect(bubble.style.bottom).toBe("auto");
  });

  test("3. clamps to the margin floor when dragged past the top-left corner", () => {
    const { getByTestId } = render(createElement(TestComponent, { onTap: vi.fn() }));
    const bubble = getByTestId("bubble");
    stubPointerCapture(bubble);
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0 } as DOMRect);

    act(() => {
      bubble.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
      bubble.dispatchEvent(pointerEvent("pointermove", { clientX: -500, clientY: -500 }));
    });

    expect(bubble.style.left).toBe("8px");
    expect(bubble.style.top).toBe("8px");
  });

  test("4. clamps to innerWidth/Height - 56 - 8 at the bottom-right corner", () => {
    const { getByTestId } = render(createElement(TestComponent, { onTap: vi.fn() }));
    const bubble = getByTestId("bubble");
    stubPointerCapture(bubble);
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0 } as DOMRect);

    act(() => {
      bubble.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
      bubble.dispatchEvent(pointerEvent("pointermove", { clientX: 5000, clientY: 5000 }));
    });

    expect(bubble.style.left).toBe(`${1200 - 56 - 8}px`);
    expect(bubble.style.top).toBe(`${800 - 56 - 8}px`);
  });

  test("5. degenerate viewport (innerWidth 40) returns margin, never an inverted range", () => {
    vi.stubGlobal("innerWidth", 40);
    vi.stubGlobal("innerHeight", 40);
    const { getByTestId } = render(createElement(TestComponent, { onTap: vi.fn() }));
    const bubble = getByTestId("bubble");
    stubPointerCapture(bubble);
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0 } as DOMRect);

    act(() => {
      bubble.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
      bubble.dispatchEvent(pointerEvent("pointermove", { clientX: 5000, clientY: 5000 }));
    });

    expect(bubble.style.left).toBe("8px");
    expect(bubble.style.top).toBe("8px");
  });

  test("6. movement <=4px on both axes counts as a tap -> onTap called once", () => {
    const onTap = vi.fn();
    const { getByTestId } = render(createElement(TestComponent, { onTap }));
    const bubble = getByTestId("bubble");
    stubPointerCapture(bubble);
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0 } as DOMRect);

    act(() => {
      bubble.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
      bubble.dispatchEvent(pointerEvent("pointermove", { clientX: 2, clientY: 2 }));
      bubble.dispatchEvent(pointerEvent("pointerup", { clientX: 2, clientY: 2 }));
    });

    expect(onTap).toHaveBeenCalledTimes(1);
  });

  test("7. movement >4px -> onTap NOT called on pointerup", () => {
    const onTap = vi.fn();
    const { getByTestId } = render(createElement(TestComponent, { onTap }));
    const bubble = getByTestId("bubble");
    stubPointerCapture(bubble);
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0 } as DOMRect);

    act(() => {
      bubble.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
      bubble.dispatchEvent(pointerEvent("pointermove", { clientX: 50, clientY: 50 }));
      bubble.dispatchEvent(pointerEvent("pointerup", { clientX: 50, clientY: 50 }));
    });

    expect(onTap).not.toHaveBeenCalled();
  });

  test("8. pointermove without a preceding pointerdown is a no-op", () => {
    const { getByTestId } = render(createElement(TestComponent, { onTap: vi.fn() }));
    const bubble = getByTestId("bubble");
    stubPointerCapture(bubble);

    act(() => {
      bubble.dispatchEvent(pointerEvent("pointermove", { clientX: 500, clientY: 500 }));
    });

    expect(bubble.style.left).toBe("");
    expect(bubble.style.right).toBe("18px");
  });

  test("9. setPointerCapture on down and releasePointerCapture on up, with the same pointerId", () => {
    const { getByTestId } = render(createElement(TestComponent, { onTap: vi.fn() }));
    const bubble = getByTestId("bubble");
    stubPointerCapture(bubble);
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0 } as DOMRect);

    act(() => {
      bubble.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0, pointerId: 7 }));
      bubble.dispatchEvent(pointerEvent("pointerup", { clientX: 0, clientY: 0, pointerId: 7 }));
    });

    expect(bubble.setPointerCapture).toHaveBeenCalledWith(7);
    expect(bubble.releasePointerCapture).toHaveBeenCalledWith(7);
  });

  test("10. RED for the bug: drag to far corner at 1200x800, shrink to 400x400, resize re-clamps", () => {
    const { getByTestId } = render(createElement(TestComponent, { onTap: vi.fn() }));
    const bubble = getByTestId("bubble");
    stubPointerCapture(bubble);
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0 } as DOMRect);

    act(() => {
      bubble.dispatchEvent(pointerEvent("pointerdown", { clientX: 0, clientY: 0 }));
      bubble.dispatchEvent(pointerEvent("pointermove", { clientX: 5000, clientY: 5000 }));
    });

    expect(bubble.style.left).toBe(`${1200 - 56 - 8}px`);
    expect(bubble.style.top).toBe(`${800 - 56 - 8}px`);

    vi.stubGlobal("innerWidth", 400);
    vi.stubGlobal("innerHeight", 400);

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(bubble.style.left).toBe(`${400 - 56 - 8}px`);
    expect(bubble.style.top).toBe(`${400 - 56 - 8}px`);
  });

  test("11. resize while pos is null leaves the default style untouched", () => {
    const { getByTestId } = render(createElement(TestComponent, { onTap: vi.fn() }));
    const bubble = getByTestId("bubble");

    vi.stubGlobal("innerWidth", 400);
    vi.stubGlobal("innerHeight", 400);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(bubble.style.right).toBe("18px");
    expect(bubble.style.bottom).toBe("var(--jt-chat-bubble-bottom, 96px)");
    expect(bubble.style.left).toBe("");
  });

  test("12. unmount removes the resize listener", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(createElement(TestComponent, { onTap: vi.fn() }));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
