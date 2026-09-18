import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { useLobbyColumnMaxHeight } from "../useLobbyColumnMaxHeight";

// jsdom's layout engine always returns zero-sized rects and doesn't run a
// real rAF loop, so this hook's math (which entirely depends on
// getBoundingClientRect + window.inner*) needs every one of those stubbed
// explicitly, or every assertion below would just compare 0 to 0 and pass
// for the wrong reason.

type Props = Parameters<typeof useLobbyColumnMaxHeight>[0];

function TestComponent(props: Props) {
  const { colRef, configScrollRef, actionBarRef } = useLobbyColumnMaxHeight(props);
  return createElement(
    "div",
    null,
    createElement("div", { ref: colRef, "data-testid": "col" }),
    createElement("div", { ref: configScrollRef, "data-testid": "configScroll" }),
    createElement("div", { ref: actionBarRef, "data-testid": "actionBar" }),
  );
}

const baseProps: Props = {
  lobbyTab: "players",
  isHost: true,
  activeGameId: "tateti",
  playerCount: 2,
  maxPlayers: 4,
  showAllSeats: false,
};

function stubRect(el: HTMLElement, rect: Partial<DOMRect>) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
}

let rafCallbacks: FrameRequestCallback[];

beforeEach(() => {
  rafCallbacks = [];
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useLobbyColumnMaxHeight", () => {
  test("clears maxHeight on both columns below the 900px desktop breakpoint", () => {
    vi.stubGlobal("innerWidth", 800);
    vi.stubGlobal("innerHeight", 1000);

    const { getByTestId } = render(createElement(TestComponent, baseProps));
    const col = getByTestId("col");
    const configScroll = getByTestId("configScroll");
    col.style.maxHeight = "500px";
    configScroll.style.maxHeight = "500px";

    act(() => {
      rafCallbacks.forEach(cb => cb(0));
    });

    expect(col.style.maxHeight).toBe("");
    expect(configScroll.style.maxHeight).toBe("");
  });

  test("clamps computed max-height to the [200, 600] range at desktop width", () => {
    vi.stubGlobal("innerWidth", 1200);
    vi.stubGlobal("innerHeight", 1000);

    const { getByTestId } = render(createElement(TestComponent, baseProps));
    const col = getByTestId("col");
    const configScroll = getByTestId("configScroll");
    const actionBar = getByTestId("actionBar");

    // Huge available space -> clamps to the 600px ceiling.
    stubRect(col, { top: 0 });
    stubRect(configScroll, { top: 0 });
    stubRect(actionBar, { height: 0 });

    act(() => {
      rafCallbacks.forEach(cb => cb(0));
    });

    expect(col.style.maxHeight).toBe("600px");
    expect(configScroll.style.maxHeight).toBe("600px");
  });

  test("clamps to the 200px floor when available space is very small", () => {
    vi.stubGlobal("innerWidth", 1200);
    vi.stubGlobal("innerHeight", 300);

    const { getByTestId } = render(createElement(TestComponent, baseProps));
    const col = getByTestId("col");
    const configScroll = getByTestId("configScroll");
    const actionBar = getByTestId("actionBar");

    stubRect(col, { top: 250 });
    stubRect(configScroll, { top: 250 });
    stubRect(actionBar, { height: 100 });

    act(() => {
      rafCallbacks.forEach(cb => cb(0));
    });

    expect(col.style.maxHeight).toBe("200px");
    expect(configScroll.style.maxHeight).toBe("200px");
  });

  test("subtracts the action bar height and bottom gap from available space", () => {
    vi.stubGlobal("innerWidth", 1200);
    vi.stubGlobal("innerHeight", 1000);

    const { getByTestId } = render(createElement(TestComponent, baseProps));
    const col = getByTestId("col");
    const configScroll = getByTestId("configScroll");
    const actionBar = getByTestId("actionBar");

    // available = 1000 - top(100) - barHeight(50) - gap(16) = 834 -> clamps to 600
    stubRect(col, { top: 100 });
    stubRect(configScroll, { top: 100 });
    stubRect(actionBar, { height: 50 });

    act(() => {
      rafCallbacks.forEach(cb => cb(0));
    });

    expect(col.style.maxHeight).toBe("600px");

    // Now push top close enough to land inside the clamp range.
    stubRect(col, { top: 550 });
    stubRect(configScroll, { top: 550 });
    stubRect(actionBar, { height: 50 });

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    // available = 1000 - 550 - 50 - 16 = 384
    expect(col.style.maxHeight).toBe("384px");
    expect(configScroll.style.maxHeight).toBe("384px");
  });

  test("removes the resize listener and cancels the pending rAF on unmount", () => {
    vi.stubGlobal("innerWidth", 1200);
    vi.stubGlobal("innerHeight", 1000);
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const cancelSpy = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancelSpy);

    const { unmount } = render(createElement(TestComponent, baseProps));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(cancelSpy).toHaveBeenCalled();
  });
});
