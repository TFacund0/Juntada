import { describe, expect, test } from "vitest";
import { isTypingTarget, resolveShortcut } from "../utils/shortcuts";

const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
});

describe("resolveShortcut", () => {
  test("1–9 pick the palette colors", () => {
    expect(resolveShortcut(key("1"), 10)).toEqual({ type: "color", index: 0 });
    expect(resolveShortcut(key("9"), 10)).toEqual({ type: "color", index: 8 });
    expect(resolveShortcut(key("0"), 10)).toBeNull();
  });

  test("B / E / G pick pencil, eraser and bucket (any case)", () => {
    expect(resolveShortcut(key("b"), 10)).toEqual({ type: "mode", mode: "draw" });
    expect(resolveShortcut(key("E"), 10)).toEqual({ type: "mode", mode: "erase" });
    expect(resolveShortcut(key("g"), 10)).toEqual({ type: "mode", mode: "fill" });
  });

  test("[ and ] step the size, and do nothing at the ends", () => {
    expect(resolveShortcut(key("]"), 10)).toEqual({ type: "size", size: 20 });
    expect(resolveShortcut(key("["), 10)).toEqual({ type: "size", size: 4 });
    expect(resolveShortcut(key("]"), 20)).toBeNull();
    expect(resolveShortcut(key("["), 4)).toBeNull();
  });

  test("Ctrl+Z and Cmd+Z undo", () => {
    expect(resolveShortcut(key("z", { ctrlKey: true }), 10)).toEqual({ type: "undo" });
    expect(resolveShortcut(key("Z", { metaKey: true }), 10)).toEqual({ type: "undo" });
    expect(resolveShortcut(key("z"), 10)).toBeNull();
  });

  test("keys combined with Ctrl/Cmd/Alt belong to the browser, not the palette", () => {
    expect(resolveShortcut(key("1", { ctrlKey: true }), 10)).toBeNull();
    expect(resolveShortcut(key("b", { metaKey: true }), 10)).toBeNull();
    expect(resolveShortcut(key("e", { altKey: true }), 10)).toBeNull();
  });

  test("other keys are ignored", () => {
    expect(resolveShortcut(key("x"), 10)).toBeNull();
    expect(resolveShortcut(key("Enter"), 10)).toBeNull();
  });
});

describe("isTypingTarget", () => {
  test("inputs, textareas and editable content are typing targets", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const inner = document.createElement("span");
    editable.appendChild(inner);
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(textarea)).toBe(true);
    expect(isTypingTarget(inner)).toBe(true);
  });

  test("buttons, the body and non-elements are not", () => {
    const off = document.createElement("div");
    off.setAttribute("contenteditable", "false");
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(off)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(window)).toBe(false);
  });
});
