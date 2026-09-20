import { describe, test, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { createElement } from "react";
import { useAutoScrollToBottom } from "../useAutoScrollToBottom";

function TestComponent({ deps, attach = true }: { deps: readonly unknown[]; attach?: boolean }) {
  const msgsRef = useAutoScrollToBottom(deps);
  return createElement("div", { ref: attach ? msgsRef : undefined, "data-testid": "msgs" });
}

describe("useAutoScrollToBottom", () => {
  test("1. sets scrollTop = scrollHeight when deps change while open", () => {
    const { getByTestId, rerender } = render(createElement(TestComponent, { deps: [true, 1] }));
    const el = getByTestId("msgs");
    Object.defineProperty(el, "scrollHeight", { value: 500, configurable: true });
    el.scrollTop = 0;

    rerender(createElement(TestComponent, { deps: [true, 2] }));

    expect(el.scrollTop).toBe(500);
    cleanup();
  });

  test("2. no-op when the ref is unattached (null node)", () => {
    expect(() => render(createElement(TestComponent, { deps: [true, 1], attach: false }))).not.toThrow();
    cleanup();
  });

  test("3. re-runs on a message-count change", () => {
    const { getByTestId, rerender } = render(createElement(TestComponent, { deps: [true, 1] }));
    const el = getByTestId("msgs");
    Object.defineProperty(el, "scrollHeight", { value: 100, configurable: true });
    el.scrollTop = 0;
    // Same deps -> effect does not re-run, scrollTop stays untouched.
    rerender(createElement(TestComponent, { deps: [true, 1] }));
    expect(el.scrollTop).toBe(0);

    Object.defineProperty(el, "scrollHeight", { value: 300, configurable: true });
    // Message count changed -> effect re-runs and scrolls to the new bottom.
    rerender(createElement(TestComponent, { deps: [true, 2] }));
    expect(el.scrollTop).toBe(300);
    cleanup();
  });
});
