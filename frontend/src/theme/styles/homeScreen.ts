// ─── Tokens de diseño exclusivos de la pantalla de inicio ────────────────────
import type { CSSProperties } from "react";
import { DEFAULT_COLORS } from "./colors";

// ── Solo pantalla de inicio (AppHeader, GamePicker, ModePicker — tokens de
//    un único consumidor, específicos de esa pantalla, no pensados para
//    ser reutilizados por los juegos) ──────────────────────────────────
export const homeScreen = {
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: `var(--jt-label, ${DEFAULT_COLORS.label})`,
    margin: "0 2px 8px",
  } satisfies CSSProperties,
  catalogCard: {
    background: "var(--jt-card-bg, rgba(255,255,255,0.04))",
    border: "1px solid var(--jt-card-border, rgba(127,119,221,0.18))",
    borderRadius: 20,
    overflow: "hidden",
    cursor: "pointer",
    transition:
      "transform 320ms cubic-bezier(0.22,1,0.36,1), box-shadow 320ms cubic-bezier(0.22,1,0.36,1), border-color 320ms cubic-bezier(0.22,1,0.36,1)",
  } satisfies CSSProperties,
  catalogThumb: {
    aspectRatio: "4 / 3",
    background: `radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--jt-accent, ${DEFAULT_COLORS.accent}) 22%, transparent), transparent 70%)`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    position: "relative",
  } satisfies CSSProperties,
  catalogName: {
    padding: "10px 12px 12px",
    fontWeight: 700,
    fontSize: 14,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    borderTop: "1px solid var(--jt-row-border, rgba(127,119,221,0.08))",
  } satisfies CSSProperties,
  soonBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    background: "rgba(0,0,0,0.5)",
    color: "#AFA9EC",
    fontSize: 9,
    fontWeight: 700,
    padding: "2px 7px",
    borderRadius: 20,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  } satisfies CSSProperties,
  modeIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxShadow: `0 10px 26px -10px color-mix(in srgb, var(--jt-accent, ${DEFAULT_COLORS.accent}) 55%, transparent)`,
  } satisfies CSSProperties,
  modeRowTitle: {
    fontWeight: 800,
    fontSize: 13,
    margin: "0 0 3px",
    fontFamily: "'Syne', sans-serif",
  } satisfies CSSProperties,
  modeRowSubtitle: {
    color: `var(--jt-muted-text, ${DEFAULT_COLORS.mutedText})`,
    fontSize: 11,
    margin: 0,
    lineHeight: 1.4,
  } satisfies CSSProperties,
};
