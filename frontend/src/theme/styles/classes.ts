// ─── Equivalente Tailwind de theme/styles/tokens.ts (migración gradual) ─────
// Mismo vocabulario de claves que `S`, pero devolviendo clases en vez de
// CSSProperties — el patrón de migración por archivo es "cambiar `S.x` por
// `T.x` y `style=` por `className=`". Solo cubre las claves ya migradas
// (empezando por SetupScreen.tsx); el resto de tokens.ts sigue viviendo en
// `S` hasta que se migren sus propios consumidores. Los valores por defecto
// de las `var(--jt-*)` deben coincidir exactamente con los de `S` — si uno
// cambia, cambiar el otro.
import clsx from "clsx";

export const card =
  "rounded-2xl border border-[var(--jt-card-border,rgba(127,119,221,0.18))] bg-[var(--jt-card-bg,rgba(255,255,255,0.04))] p-[18px_20px] mb-3.5";

export const app = "min-h-screen bg-[#0f0c1d] font-['Syne',sans-serif] text-[#e8e4f0] overflow-x-hidden";

export const title =
  "m-0 bg-gradient-to-r from-[#AFA9EC] to-[#5DCAA5] bg-clip-text text-[38px] font-extrabold tracking-[-0.03em] text-transparent";

export const cardHighlight =
  "rounded-2xl border border-[var(--jt-accent-border-soft,rgba(127,119,221,0.35))] bg-[var(--jt-accent-soft,rgba(127,119,221,0.1))] p-[18px_20px] mb-3.5";

export const label = "mb-2.5 block text-[11px] font-bold tracking-[0.1em] uppercase text-[var(--jt-label,#7f77dd)]";

export const input =
  "box-border w-full rounded-[10px] border border-[var(--jt-accent-border-soft,rgba(127,119,221,0.25))] bg-white/[0.06] px-3.5 py-[11px] font-[inherit] text-[15px] text-[#e8e4f0] outline-none";

export const muted = "text-[13px] text-[var(--jt-muted-text,#6b6490)]";

type BtnVariant = "primary" | "success" | "danger" | "ghost";

const BTN_BASE =
  "inline-flex w-full box-border items-center justify-center gap-2 rounded-xl border-none px-7 py-[13px] font-[inherit] text-[15px] font-bold transition-all duration-150";

const BTN_VARIANT: Record<BtnVariant, string> = {
  // Lee las mismas --jt-accent-* que "ghost" — un tema propio tiñe este
  // botón en vez de quedarse en el morado por defecto de toda la app.
  primary:
    "text-white bg-[linear-gradient(135deg,var(--jt-accent,#7f77dd),color-mix(in_srgb,var(--jt-accent,#7f77dd)_70%,black))] shadow-[0_4px_20px_var(--jt-accent-border-soft,rgba(127,119,221,0.35))]",
  // Lee --jt-cta-from/to/shadow — un juego con tema propio puede cambiar
  // este CTA a su propio acento en vez del verde de toda la app.
  success:
    "text-white bg-[linear-gradient(135deg,var(--jt-cta-from,#1d9e75),var(--jt-cta-to,#0f6e56))] shadow-[0_4px_20px_var(--jt-cta-shadow,rgba(29,158,117,0.3))]",
  danger: "bg-[rgba(226,75,74,0.15)] text-[#F09595] border border-[rgba(226,75,74,0.3)]",
  // Lee las mismas --jt-accent-* que CodeDisplay/QRDialog.
  ghost:
    "bg-[var(--jt-accent-soft,rgba(127,119,221,0.1))] text-[var(--jt-accent-strong,#afa9ec)] border border-[var(--jt-accent-border-soft,rgba(127,119,221,0.25))]",
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

export const wrap = "max-w-[480px] mx-auto px-4 pb-[60px]";

// Badge redondo de ícono de ModePicker — el boxShadow siempre lee
// --jt-accent (aunque la fila esté deshabilitada, ver modeIconBadge en
// ModePicker.tsx); `background`/`shadow-none` de la fila deshabilitada se
// combinan con clsx en el caller, no acá.
export const modeIconBadge =
  "flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[18px] shadow-[0_10px_26px_-10px_color-mix(in_srgb,var(--jt-accent,#7f77dd)_55%,transparent)]";

export const modeRowTitle = "m-0 mb-[3px] font-['Syne',sans-serif] text-[13px] font-extrabold";

export const modeRowSubtitle = "m-0 text-[11px] leading-[1.4] text-[var(--jt-muted-text,#6b6490)]";

export const catalogCard =
  "cursor-pointer overflow-hidden rounded-[20px] border border-[var(--jt-card-border,rgba(127,119,221,0.18))] bg-[var(--jt-card-bg,rgba(255,255,255,0.04))] transition-[transform,box-shadow,border-color] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)]";

export const catalogThumb =
  "relative flex aspect-[4/3] items-center justify-center text-[32px] bg-[radial-gradient(120%_90%_at_50%_0%,color-mix(in_srgb,var(--jt-accent,#7f77dd)_22%,transparent),transparent_70%)]";

export const soonBadge =
  "absolute right-1.5 top-1.5 rounded-[20px] bg-black/50 px-[7px] py-0.5 text-[9px] font-bold uppercase tracking-[0.04em] text-[#AFA9EC]";

export const segmentedControl = "flex bg-white/5 rounded-[10px] p-[3px] mb-2.5 gap-[3px]";

export function segmentedOption(active: boolean): string {
  return clsx(
    "flex-1 text-center py-2 rounded-lg border-none text-xs font-bold font-[inherit] cursor-pointer",
    active ? "bg-[linear-gradient(135deg,#7F77DD,#534AB7)] text-white" : "bg-transparent text-[#8079a8]",
  );
}

// Caras de FlipRevealCard (impostor). `flipFaceBack` omite radius/padding de
// `card` a propósito — se combina con `T.card` vía clsx en el caller.
export const flipFaceFront =
  "absolute inset-0 text-center bg-black/25 border border-[var(--jt-accent-border-soft,rgba(127,119,221,0.3))] flex flex-col items-center justify-center";

export function flipFaceBack(isImpostor: boolean): string {
  return clsx(
    "text-center bg-[var(--jt-card-bg,rgba(255,255,255,0.04))] flex flex-col items-center justify-center",
    isImpostor ? "border border-[rgba(224,32,43,0.4)]" : "border border-[var(--jt-accent-border-soft,rgba(127,119,221,0.3))]",
  );
}

export const flipLogoImg = "w-16 h-16 object-contain rounded-2xl mb-3.5";
export const flipHintLabel = "text-[15px] font-bold text-[var(--jt-muted-text,#6b6490)]";
export const flipRoleTitle = "text-[22px] font-extrabold text-[#F09595] m-0 mb-1";
export const flipSubLabel = "text-[13px] text-[var(--jt-muted-text,#6b6490)] mb-1.5";
export const flipMetaLine = "text-[13px] text-[var(--jt-muted-text,#6b6490)] mt-2 m-0";
export const flipMetaLineLabel = "font-extrabold text-[#e8e4f0]";
export const flipFooterHint = "text-xs text-[var(--jt-muted-text,#6b6490)] mt-2.5";

// Chrome de la ruleta (games/ruleta) — compartido entre LocalGame y RoundView.
export const wheelWrap = "relative w-[300px] max-w-full mx-auto mb-5";

export const wheelPointer =
  "absolute -top-1.5 left-1/2 z-[2] h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[20px] border-x-transparent border-t-[#EF9F27] drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]";

export const wheelDisc =
  "w-[300px] h-[300px] max-w-full aspect-square rounded-full border-4 border-[rgba(127,119,221,0.4)] shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden";

export const wheelEyebrow = "m-0 mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#7F77DD]";

export const wheelTrophy = "m-0 mb-1 text-[40px]";

export const wheelBadge =
  "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[rgba(226,75,74,0.15)] text-[11px] font-extrabold text-[#F09595]";

export const truncateLabel = "overflow-hidden text-ellipsis whitespace-nowrap";

// tutifruti ConfigPanel — separador fino entre secciones del panel.
export const divider = "border-t border-white/[0.08] my-4";

export const tabBtnOverride = "flex-1 p-2 text-[13px]";

export const segmentedBtnOverride = "flex-1 py-2.5 px-2 text-[13px]";

export function rangeInput(disabled: boolean): string {
  return clsx("w-full", disabled ? "opacity-40" : "opacity-100");
}

export function letterTile(active: boolean): string {
  return clsx(
    "w-10 h-10 rounded-[10px] font-bold text-[15px] cursor-pointer font-[inherit] transition-all duration-150",
    active
      ? "border border-[rgba(127,119,221,0.6)] bg-[linear-gradient(135deg,#7F77DD,#534AB7)] text-white shadow-[0_3px_14px_rgba(127,119,221,0.35)]"
      : "border border-white/[0.12] bg-white/[0.04] text-[#9089c0] shadow-none",
  );
}

// Grupo 6 del sweep: vocabulario compartido entre quien-soy, limon-limon,
// sintonia y tateti. Ver classes.ts header — mismos defaults --jt-* que S.

export function squareIconBtn(variant: BtnVariant): string {
  return clsx(btn(variant), "h-9 w-9 shrink-0 rounded-lg p-0");
}

export const pillGhostSmall = clsx(btn("ghost"), "w-auto px-3.5 py-1.5 text-xs");

export const deckCardWrap = "relative z-0 mx-auto h-[196px] w-[140px]";

export const rankIndex = "w-5 text-xs font-extrabold text-[#6b6490]";

export const rankName = "flex-1 text-sm font-bold";

export const rankPointsTotal = "min-w-[28px] text-right font-extrabold text-[#AFA9EC]";

export const avatarNameRow = "flex items-center justify-center gap-3";

export const avatarStatusRow = clsx(card, "flex items-center gap-3");

export const markerDotBase = "inline-block h-[13px] w-[13px] shrink-0 rounded-full border-[1.5px] border-white/40";

export const warnCard = clsx(card, "text-center border border-[rgba(226,196,74,0.35)] bg-[rgba(226,196,74,0.08)]");

export const cardCloseBtn = "absolute right-2 top-2 cursor-pointer border-none bg-transparent p-1 text-base leading-none text-[#9089c0]";

export const unstyledToggleBtn =
  "flex w-full items-center justify-between border-none bg-transparent p-0 m-0 cursor-pointer font-[inherit] text-inherit text-left";

export function rankRow(isLast: boolean): string {
  return clsx("flex items-center gap-2.5 py-1.5", !isLast && "border-b border-[rgba(127,119,221,0.08)]");
}

export function rankValue(isMax: boolean): string {
  return clsx("min-w-[24px] text-right font-extrabold", isMax ? "text-[#F09595]" : "text-[#AFA9EC]");
}

export function deltaBadge(positive: boolean): string {
  return clsx("min-w-[24px] text-right text-xs font-bold", positive ? "text-[#5DCAA5]" : "text-[#6b6490]");
}

export function psychicChoiceBtn(active: boolean): string {
  return clsx(btn(active ? "primary" : "ghost"), "flex items-center justify-start gap-2.5 px-3.5 py-2.5");
}

export function revealCard(revealed: boolean): string {
  return clsx(
    card,
    "min-h-[260px] cursor-pointer select-none text-center flex flex-col items-center justify-center",
    revealed ? "border border-[rgba(127,119,221,0.4)]" : "border border-white/[0.08]",
  );
}

export function markerLabel(isMe: boolean): string {
  return clsx(isMe ? "font-extrabold text-white" : "font-semibold text-[#b8b0d4]");
}

export function turnChip(active: boolean): string {
  return clsx(
    "flex items-center gap-1.5 rounded-[20px] py-1 pl-1 pr-2.5",
    active ? "bg-[rgba(93,202,165,0.15)] border border-[#5DCAA5]" : "bg-white/[0.04] border border-[rgba(127,119,221,0.15)]",
  );
}

export function turnChipLabel(active: boolean): string {
  return clsx("text-xs", active ? "font-extrabold text-[#5DCAA5]" : "font-semibold text-[#b8b0d4]");
}

export function tatetiCell(isWinning: boolean, clickable: boolean): string {
  return clsx(
    clickable ? "cursor-pointer" : "cursor-default",
    isWinning
      ? "bg-[rgba(93,202,165,0.18)] border border-[rgba(93,202,165,0.5)]"
      : "bg-white/[0.04] border border-[rgba(127,119,221,0.25)]",
  );
}

// GuessFlash (quien-soy RoundView) — color-mix() background/border built from
// a correct/incorrect color, same arbitrary-value syntax as modeIconBadge /
// catalogThumb above. The @keyframes guess-flash-pop animation stays in the
// component's own <style> block — not a Tailwind concern.
export function guessFlash(correct: boolean): string {
  return clsx(
    "fixed top-1/2 left-1/2 z-[var(--jt-z-round-overlay,500)] pointer-events-none rounded-2xl p-[22px_32px] text-center shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
    correct
      ? "bg-[color-mix(in_srgb,#5DCAA5_15%,transparent)] border border-[color-mix(in_srgb,#5DCAA5_50%,transparent)]"
      : "bg-[color-mix(in_srgb,#F09595_15%,transparent)] border border-[color-mix(in_srgb,#F09595_50%,transparent)]",
  );
}

// resultCardBg (quien-soy RoundView) — background variant for the last-guess
// card, combined with `card` at the call site via clsx (same pattern as
// `revealCard` combining with `card` above).
export function resultCardBg(correct: boolean): string {
  return correct ? "bg-[rgba(93,202,165,0.12)]" : "bg-[rgba(240,149,149,0.1)]";
}

// outcomeCard (quien-soy RoundView) — border/boxShadow/color 3-way variant for
// the "my outcome" card once a player solved/eliminated/conceded.
export function outcomeCard(outcome: "solved" | "eliminated" | "conceded" | null): string {
  return clsx(
    "border",
    outcome === "solved"
      ? "border-[rgba(93,202,165,0.5)] shadow-[0_0_16px_rgba(93,202,165,0.2)]"
      : "border-[rgba(240,149,149,0.5)] shadow-[0_0_16px_rgba(240,149,149,0.2)]",
  );
}

// Grupo 3 del sweep: torneo-fútbol. Tabla de estadísticas y "camino del
// torneo", compartidas entre ChampionPhase.tsx y LocalGame.tsx (que duplica
// inline la misma UI para el modo un-solo-dispositivo).
export const statTableHeader = "flex text-[11px] text-[#6b6490] pb-2 border-b border-[rgba(127,119,221,0.15)]";

// El ancho de columna difiere entre header (36px) y body (32px) en el código
// original — se preserva la inconsistencia tal cual, no se unifica.
export const statTableHeaderCol = "w-9 shrink-0 text-center";
export const statTableCol = "w-8 shrink-0 text-center";

export function statTableColWide(bold: boolean): string {
  return clsx("w-10 shrink-0 text-center", bold && "font-bold");
}

export const statTableRow = "flex items-center py-2 border-b border-[rgba(127,119,221,0.08)] text-[13px]";

export const pathRoundLabel = "m-0 mb-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-[#7F77DD]";

export const pathMatchRow = "flex items-center gap-2 py-1 text-[13px]";

export function pathEntrantName(isWinner: boolean): string {
  return clsx("flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap", isWinner ? "text-[#5DCAA5]" : "text-[#9089c0]");
}

// Bracket / partidos — compartidas entre BracketPhase.tsx y LocalGame.tsx.
export function matchSide(isLoser: boolean): string {
  return clsx("flex items-center gap-2 min-w-0 flex-1", isLoser ? "opacity-45" : "opacity-100");
}

export function matchSideName(isWinner: boolean): string {
  return clsx(
    "m-0 font-bold text-[13px] min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
    isWinner ? "text-[#5DCAA5]" : "text-[#e8e4f0]",
  );
}

export const matchSideTeam = "m-0 text-[11px] text-[#7F77DD] overflow-hidden text-ellipsis whitespace-nowrap";

// No reutiliza `cardHighlight` directamente: pisar su `padding`/`margin-bottom`
// con otra clase de la misma propiedad no tiene orden de cascada garantizado
// en Tailwind — se repiten los valores base (radius/border/bg) con el
// padding/margin propios de esta card en un único string sin colisiones.
export function matchCard(highlighted: boolean): string {
  return clsx(
    "rounded-2xl border bg-[var(--jt-accent-soft,rgba(127,119,221,0.1))] p-[14px_16px] mb-2.5",
    highlighted ? "border-[rgba(93,202,165,0.5)]" : "border-[var(--jt-accent-border-soft,rgba(127,119,221,0.35))]",
  );
}

export const avatarPlaceholder = "h-[30px] w-[30px] shrink-0 rounded-full border border-dashed border-[rgba(127,119,221,0.3)]";

// Solo TeamConfigPanel.tsx — preview de cruces en la config (distinto del
// matchCard en vivo: borde fino de preview, no basado en cardHighlight).
export function bracketPairCard(isBye: boolean): string {
  return clsx(
    "mb-2.5 rounded-xl p-[10px_12px] border",
    isBye ? "border-white/[0.08] bg-white/[0.02]" : "border-[rgba(127,119,221,0.35)] bg-[rgba(127,119,221,0.06)]",
  );
}

export const T = {
  app,
  card,
  cardHighlight,
  title,
  label,
  input,
  muted,
  btn,
  toggle,
  knob,
  bigReveal,
  pill,
  wrap,
  modeIconBadge,
  modeRowTitle,
  modeRowSubtitle,
  catalogCard,
  catalogThumb,
  soonBadge,
  segmentedControl,
  segmentedOption,
  flipFaceFront,
  flipFaceBack,
  flipLogoImg,
  flipHintLabel,
  flipRoleTitle,
  flipSubLabel,
  flipMetaLine,
  flipMetaLineLabel,
  flipFooterHint,
  wheelWrap,
  wheelPointer,
  wheelDisc,
  wheelEyebrow,
  wheelTrophy,
  wheelBadge,
  truncateLabel,
  divider,
  tabBtnOverride,
  segmentedBtnOverride,
  rangeInput,
  letterTile,
  squareIconBtn,
  pillGhostSmall,
  deckCardWrap,
  rankIndex,
  rankName,
  rankPointsTotal,
  avatarNameRow,
  avatarStatusRow,
  markerDotBase,
  warnCard,
  cardCloseBtn,
  unstyledToggleBtn,
  rankRow,
  rankValue,
  deltaBadge,
  psychicChoiceBtn,
  revealCard,
  markerLabel,
  turnChip,
  turnChipLabel,
  tatetiCell,
  guessFlash,
  resultCardBg,
  outcomeCard,
  statTableHeader,
  statTableHeaderCol,
  statTableCol,
  statTableColWide,
  statTableRow,
  pathRoundLabel,
  pathMatchRow,
  pathEntrantName,
  matchSide,
  matchSideName,
  matchSideTeam,
  matchCard,
  avatarPlaceholder,
  bracketPairCard,
};
