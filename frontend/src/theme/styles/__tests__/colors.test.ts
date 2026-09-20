import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_COLORS } from "../colors";

// Maps DEFAULT_COLORS camelCase keys to their sharedChrome.css :root var name.
const CSS_VAR_BY_KEY: Record<keyof typeof DEFAULT_COLORS, string> = {
  accent: "--jt-accent",
  accentStrong: "--jt-accent-strong",
  surface: "--jt-surface",
  muted: "--jt-muted",
  ctaFrom: "--jt-cta-from",
  ctaTo: "--jt-cta-to",
  bg: "--jt-bg",
  label: "--jt-label",
  mutedText: "--jt-muted-text",
  dangerText: "--jt-danger-text",
  warnText: "--jt-warn-text",
};

const cssPath = path.resolve(__dirname, "../../sharedChrome.css");
const cssSource = readFileSync(cssPath, "utf-8");
const rootBlock = cssSource.slice(cssSource.indexOf(":root"), cssSource.indexOf("}", cssSource.indexOf(":root")));

function readCssVar(name: string): string {
  const match = rootBlock.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!match) throw new Error(`CSS var ${name} not found in :root block`);
  return match[1].toLowerCase();
}

describe("DEFAULT_COLORS drift guard", () => {
  test("every DEFAULT_COLORS entry matches its sharedChrome.css :root var", () => {
    for (const [key, cssVar] of Object.entries(CSS_VAR_BY_KEY)) {
      const expected = readCssVar(cssVar);
      const actual = DEFAULT_COLORS[key as keyof typeof DEFAULT_COLORS].toLowerCase();
      expect(actual).toBe(expected);
    }
  });
});
