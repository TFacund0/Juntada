import { afterEach, describe, expect, test } from "vitest";
import { renderHook } from "@testing-library/react";
import { useResizesContentViewport, withResizesContent } from "../hooks/useResizesContentViewport";

const ORIGINAL = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";

describe("withResizesContent", () => {
  test("appends the directive once", () => {
    expect(withResizesContent(ORIGINAL)).toBe(`${ORIGINAL}, interactive-widget=resizes-content`);
    expect(withResizesContent(`${ORIGINAL}, interactive-widget=resizes-content`)).toBe(`${ORIGINAL}, interactive-widget=resizes-content`);
    expect(withResizesContent("")).toBe("interactive-widget=resizes-content");
  });
});

describe("useResizesContentViewport", () => {
  afterEach(() => document.head.querySelector('meta[name="viewport"]')?.remove());

  test("adds the directive while mounted and restores the original content on unmount", () => {
    const meta = document.createElement("meta");
    meta.name = "viewport";
    meta.content = ORIGINAL;
    document.head.appendChild(meta);

    const { unmount } = renderHook(() => useResizesContentViewport());
    expect(meta.content).toContain("interactive-widget=resizes-content");
    unmount();
    expect(meta.content).toBe(ORIGINAL);
  });

  test("does nothing without a viewport meta", () => {
    expect(() => renderHook(() => useResizesContentViewport()).unmount()).not.toThrow();
  });
});
