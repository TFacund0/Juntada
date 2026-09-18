import { describe, expect, it } from "vitest";
import { escapeHtml, shuffle } from "./index";

describe("shuffle", () => {
  it("returns a new array with the same elements", () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect(result).not.toBe(input);
    expect(result.sort()).toEqual(input.sort());
  });

  it("doesn't mutate the input array", () => {
    const input = [1, 2, 3];
    const copy = [...input];
    shuffle(input);
    expect(input).toEqual(copy);
  });

  it("handles an empty array", () => {
    expect(shuffle([])).toEqual([]);
  });
});

describe("escapeHtml", () => {
  it("escapes all five special characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("Juan Pérez")).toBe("Juan Pérez");
  });
});
