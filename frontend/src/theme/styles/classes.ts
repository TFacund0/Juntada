// ─── Equivalente Tailwind de theme/styles/tokens.ts (migración gradual) ─────
// Mismo vocabulario de claves que `S`, pero devolviendo clases en vez de
// CSSProperties — el patrón de migración por archivo es "cambiar `S.x` por
// `T.x` y `style=` por `className=`". Solo cubre las claves ya migradas
// (empezando por SetupScreen.tsx); el resto de tokens.ts sigue viviendo en
// `S` hasta que se migren sus propios consumidores. Los valores por defecto
// de las `var(--jt-*)` deben coincidir exactamente con los de `S` — si uno
// cambia, cambiar el otro.
import clsx from "clsx";
import { DEFAULT_COLORS } from "./colors";

export const card =
  "rounded-2xl border border-[var(--jt-card-border,rgba(127,119,221,0.18))] bg-[var(--jt-card-bg,rgba(255,255,255,0.04))] p-[18px_20px] mb-3.5";

export const title =
  "m-0 bg-gradient-to-r from-[#AFA9EC] to-[#5DCAA5] bg-clip-text text-[38px] font-extrabold tracking-[-0.03em] text-transparent";

export const cardHighlight =
  "rounded-2xl border border-[var(--jt-accent-border-soft,rgba(127,119,221,0.35))] bg-[var(--jt-accent-soft,rgba(127,119,221,0.1))] p-[18px_20px] mb-3.5";

export const label = `mb-2.5 block text-[11px] font-bold tracking-[0.1em] uppercase text-[var(--jt-label,${DEFAULT_COLORS.label})]`;

export const input =
  "box-border w-full rounded-[10px] border border-[var(--jt-accent-border-soft,rgba(127,119,221,0.25))] bg-white/[0.06] px-3.5 py-[11px] font-[inherit] text-[15px] text-[#e8e4f0] outline-none";

export const muted = `text-[13px] text-[var(--jt-muted-text,${DEFAULT_COLORS.mutedText})]`;

type BtnVariant = "primary" | "success" | "danger" | "ghost";

const BTN_BASE =
  "inline-flex w-full box-border items-center justify-center gap-2 rounded-xl border-none px-7 py-[13px] font-[inherit] text-[15px] font-bold transition-all duration-150";

const BTN_VARIANT: Record<BtnVariant, string> = {
  // Lee las mismas --jt-accent-* que "ghost" — un tema propio tiñe este
  // botón en vez de quedarse en el morado por defecto de toda la app.
  primary: `text-white bg-[linear-gradient(135deg,var(--jt-accent,${DEFAULT_COLORS.accent}),color-mix(in_srgb,var(--jt-accent,${DEFAULT_COLORS.accent})_70%,black))] shadow-[0_4px_20px_var(--jt-accent-border-soft,rgba(127,119,221,0.35))]`,
  // Lee --jt-cta-from/to/shadow — un juego con tema propio puede cambiar
  // este CTA a su propio acento en vez del verde de toda la app.
  success: `text-white bg-[linear-gradient(135deg,var(--jt-cta-from,${DEFAULT_COLORS.ctaFrom}),var(--jt-cta-to,${DEFAULT_COLORS.ctaTo}))] shadow-[0_4px_20px_var(--jt-cta-shadow,rgba(29,158,117,0.3))]`,
  danger: "bg-[rgba(226,75,74,0.15)] text-[#F09595] border border-[rgba(226,75,74,0.3)]",
  // Lee las mismas --jt-accent-* que CodeDisplay/QRDialog.
  ghost: `bg-[var(--jt-accent-soft,rgba(127,119,221,0.1))] text-[var(--jt-accent-strong,${DEFAULT_COLORS.accentStrong})] border border-[var(--jt-accent-border-soft,rgba(127,119,221,0.25))]`,
};

export function btn(variant: BtnVariant = "primary", disabled = false): string {
  return clsx(BTN_BASE, BTN_VARIANT[variant], disabled ? "cursor-default opacity-40 shadow-none" : "cursor-pointer");
}

export function toggle(on: boolean): string {
  return clsx(
    "relative h-6 w-11 shrink-0 cursor-pointer rounded-xl border transition-[background,box-shadow] duration-200",
    on
      ? "bg-[rgba(29,158,117,0.8)] border-[rgba(29,158,117,0.5)] shadow-[0_0_0_3px_rgba(29,158,117,0.15)]"
      : "bg-white/10 border-white/10 shadow-[0_0_0_0_transparent]",
  );
}

export function knob(on: boolean): string {
  return clsx(
    "absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)] transition-[left] duration-[250ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
    on ? "left-[22px]" : "left-0.5",
  );
}

export const bigReveal = "text-[28px] font-extrabold text-[#AFA9EC] text-center tracking-[-0.02em] my-3 leading-[1.2]";

export function pill(on: boolean): string {
  return clsx(
    "inline-flex items-center gap-1.5 rounded-[20px] px-3 py-1 text-xs font-semibold",
    on
      ? "bg-[rgba(29,158,117,0.15)] text-[#5DCAA5] border border-[rgba(29,158,117,0.35)]"
      : "bg-white/[0.06] text-[#6b6490] border border-white/[0.08]",
  );
}

export const segmentedControl = "flex bg-white/5 rounded-[10px] p-[3px] mb-2.5 gap-[3px]";

export function segmentedOption(active: boolean): string {
  return clsx(
    "flex-1 text-center py-2 rounded-lg border-none text-xs font-bold font-[inherit] cursor-pointer",
    active ? "bg-[linear-gradient(135deg,#7F77DD,#534AB7)] text-white" : "bg-transparent text-[#8079a8]",
  );
}

export const T = { card, cardHighlight, title, label, input, muted, btn, toggle, knob, bigReveal, pill, segmentedControl, segmentedOption };
