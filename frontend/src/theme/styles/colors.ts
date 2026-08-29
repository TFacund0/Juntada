// Mirror of theme/sharedChrome.css :root. Key -> CSS var: camelCase -> `--jt-<kebab-case>`
// (accent -> --jt-accent, accentStrong -> --jt-accent-strong, mutedText -> --jt-muted-text,
// ctaFrom -> --jt-cta-from, ctaTo -> --jt-cta-to, dangerText -> --jt-danger-text,
// warnText -> --jt-warn-text).
// Only for `var(--jt-x, ${DEFAULT_COLORS.x})` fallbacks; sharedChrome.css stays authoritative
// at runtime. See theme/styles/__tests__/colors.test.ts for the drift guard.
export const DEFAULT_COLORS = {
  accent: "#7f77dd",
  accentStrong: "#afa9ec",
  surface: "#171329",
  muted: "#5a5280",
  ctaFrom: "#1d9e75",
  ctaTo: "#0f6e56",
  bg: "#0f0c1d",
  label: "#7f77dd",
  mutedText: "#6b6490",
  dangerText: "#f09595",
  warnText: "#e2c44a",
} as const satisfies Record<string, string>;
