// ─── Tokens de diseño / diccionario de estilos inline ────────────────────────
import type { CSSProperties } from "react";

export const S = {
  // ── Compartido por (casi) todo juego/pantalla ─────────────────────────────
  app: {
    minHeight: "100vh",
    background: "#0f0c1d",
    fontFamily: "'Syne', sans-serif",
    color: "#e8e4f0",
    overflowX: "hidden",
  } satisfies CSSProperties,
  // paddingTop deliberadamente afuera de acá (no es "padding" shorthand) — lo
  // pone la clase .jt-content-pad-top (theme/sharedChrome.css) en vez de un
  // valor fijo, porque necesita crecer en pantallas grandes (el navbar
  // in-game crece desde los 900px) y un valor puesto por `style` inline le
  // gana siempre a cualquier regla de una hoja de estilos — así que si
  // "padding" (shorthand) incluyera el top acá, ninguna clase podría
  // ajustarlo por breakpoint.
  wrap: { maxWidth: 480, margin: "0 auto", paddingLeft: 16, paddingRight: 16, paddingBottom: 60 } satisfies CSSProperties,
  header: {
    textAlign: "center",
    padding: "32px 0 20px",
    borderBottom: "1px solid var(--jt-accent-border-soft, rgba(127,119,221,0.2))",
    marginBottom: 24,
  } satisfies CSSProperties,
  title: {
    fontSize: 38,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    background: "linear-gradient(90deg,#AFA9EC,#5DCAA5)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    margin: 0,
  } satisfies CSSProperties,
  // background/border leen las variables --jt-card-*/--jt-accent-border de
  // theme/sharedChrome.css — los valores por defecto coinciden exactamente,
  // así que esto se queda como un no-op para todo juego sin gameTheme; las
  // cards de lobby/setup de un juego con tema propio (incluyendo la card
  // compartida de lista de jugadores del lobby online) adoptan su propia
  // paleta gratis, sin ningún branching por juego acá.
  card: {
    background: "var(--jt-card-bg, rgba(255,255,255,0.04))",
    border: "1px solid var(--jt-card-border, rgba(127,119,221,0.18))",
    borderRadius: 16,
    padding: "18px 20px",
    marginBottom: 14,
  } satisfies CSSProperties,
  cardHighlight: {
    background: "var(--jt-accent-soft, rgba(127,119,221,0.1))",
    border: "1px solid var(--jt-accent-border-soft, rgba(127,119,221,0.35))",
    borderRadius: 16,
    padding: "18px 20px",
    marginBottom: 14,
  } satisfies CSSProperties,
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--jt-label, #7F77DD)",
    marginBottom: 10,
    display: "block",
  } satisfies CSSProperties,
  input: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid var(--jt-accent-border-soft, rgba(127,119,221,0.25))",
    borderRadius: 10,
    padding: "11px 14px",
    color: "#e8e4f0",
    fontSize: 15,
    fontFamily: "inherit",
    width: "100%",
    outline: "none",
    boxSizing: "border-box",
  } satisfies CSSProperties,
  btn: (variant: "primary" | "success" | "danger" | "ghost" = "primary", disabled = false): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "13px 28px",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 15,
    cursor: disabled ? "default" : "pointer",
    border: "none",
    transition: "all 0.15s",
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
    opacity: disabled ? 0.4 : 1,
    ...(variant === "primary"
      ? {
          // Lee las mismas variables --jt-accent-* que "ghost" más abajo —
          // un tema propio tiñe este botón en vez de quedarse en el morado
          // por defecto de toda la app.
          background: "linear-gradient(135deg, var(--jt-accent, #7F77DD), color-mix(in srgb, var(--jt-accent, #7F77DD) 70%, black))",
          color: "#fff",
          boxShadow: disabled ? "none" : "0 4px 20px var(--jt-accent-border-soft, rgba(127,119,221,0.35))",
        }
      : variant === "success"
        ? {
            // Lee --jt-cta-from/to/shadow (theme/sharedChrome.css) — un
            // juego con tema propio (ver gameTheme en GameDef) puede
            // cambiar este CTA a su propio acento en vez del verde de toda
            // la app; el resto de los juegos mantiene ese verde vía los
            // valores por defecto de :root de esas variables.
            background: "linear-gradient(135deg, var(--jt-cta-from, #1D9E75), var(--jt-cta-to, #0F6E56))",
            color: "#fff",
            boxShadow: disabled ? "none" : "0 4px 20px var(--jt-cta-shadow, rgba(29,158,117,0.3))",
          }
        : variant === "danger"
          ? { background: "rgba(226,75,74,0.15)", color: "#F09595", border: "1px solid rgba(226,75,74,0.3)" }
          : {
              // Lee las mismas variables --jt-accent-* que usan
              // CodeDisplay/QRDialog (theme/sharedChrome.css) — mismo
              // razonamiento que "success" más arriba.
              background: "var(--jt-accent-soft, rgba(127,119,221,0.1))",
              color: "var(--jt-accent-strong, #AFA9EC)",
              border: "1px solid var(--jt-accent-border-soft, rgba(127,119,221,0.25))",
            }),
  }),
  bigReveal: {
    fontSize: 28,
    fontWeight: 800,
    color: "#AFA9EC",
    textAlign: "center",
    letterSpacing: "-0.02em",
    margin: "12px 0",
    lineHeight: 1.2,
  } satisfies CSSProperties,
  muted: { color: "var(--jt-muted-text, #6b6490)", fontSize: 13 } satisfies CSSProperties,
  pill: (on: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    background: on ? "rgba(29,158,117,0.15)" : "rgba(255,255,255,0.06)",
    color: on ? "#5DCAA5" : "#6b6490",
    border: `1px solid ${on ? "rgba(29,158,117,0.35)" : "rgba(255,255,255,0.08)"}`,
  }),
  toggle: (on: boolean): CSSProperties => ({
    width: 44,
    height: 24,
    borderRadius: 12,
    position: "relative",
    flexShrink: 0,
    background: on ? "rgba(29,158,117,0.8)" : "rgba(255,255,255,0.1)",
    border: `1px solid ${on ? "rgba(29,158,117,0.5)" : "rgba(255,255,255,0.1)"}`,
    cursor: "pointer",
    transition: "background 0.2s, box-shadow 0.2s",
    boxShadow: on ? "0 0 0 3px rgba(29,158,117,0.15)" : "0 0 0 0 transparent",
  }),
  knob: (on: boolean): CSSProperties => ({
    position: "absolute",
    top: 2,
    left: on ? 22 : 2,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#fff",
    transition: "left 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
    boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
  }),
  segmentedControl: {
    display: "flex",
    background: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
    gap: 3,
  } satisfies CSSProperties,
  segmentedOption: {
    flex: 1,
    textAlign: "center",
    padding: "8px 0",
    borderRadius: 8,
    background: "none",
    border: "none",
    color: "#8079a8",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
  } satisfies CSSProperties,
  segmentedOptionActive: {
    flex: 1,
    textAlign: "center",
    padding: "8px 0",
    borderRadius: 8,
    background: "linear-gradient(135deg,#7F77DD,#534AB7)",
    border: "none",
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
  } satisfies CSSProperties,
  dropdownMenu: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    width: 190,
    background: "#161029",
    border: "1px solid rgba(127,119,221,0.35)",
    borderRadius: 12,
    boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
    padding: 6,
    zIndex: 5,
    textAlign: "left",
  } satisfies CSSProperties,
  dropdownMenuItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "10px 10px",
    background: "none",
    border: "none",
    borderRadius: 8,
    color: "#e8e4f0",
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
    boxSizing: "border-box",
  } satisfies CSSProperties,

  // ── Solo pantalla de inicio (AppHeader, GamePicker, ModePicker — tokens de
  //    un único consumidor, específicos de esa pantalla, no pensados para
  //    ser reutilizados por los juegos) ──────────────────────────────────
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--jt-label, #7F77DD)",
    margin: "0 2px 8px",
  } satisfies CSSProperties,
  searchBar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "var(--jt-card-bg, rgba(255,255,255,0.04))",
    border: "1px solid var(--jt-card-border, rgba(127,119,221,0.18))",
    borderRadius: 999,
    padding: "0 16px",
    height: 46,
    marginBottom: 18,
    backdropFilter: "blur(10px)",
  } satisfies CSSProperties,
  searchInput: {
    flex: 1,
    background: "none",
    border: "none",
    outline: "none",
    color: "#e8e4f0",
    fontSize: 14,
    fontFamily: "inherit",
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
    background: "radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--jt-accent, #7f77dd) 22%, transparent), transparent 70%)",
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
  groupFlowBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    height: 40,
    background: "rgba(127,119,221,0.1)",
    border: "1px solid rgba(127,119,221,0.3)",
    borderRadius: 10,
    color: "#e8e4f0",
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
  } satisfies CSSProperties,
  namePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 12px 5px 6px",
    borderRadius: 999,
    background: "rgba(127,119,221,0.1)",
    border: "1px solid rgba(127,119,221,0.3)",
    cursor: "pointer",
    fontFamily: "inherit",
  } satisfies CSSProperties,
  modeIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxShadow: "0 10px 26px -10px color-mix(in srgb, var(--jt-accent, #7f77dd) 55%, transparent)",
  } satisfies CSSProperties,
  modeRowTitle: {
    fontWeight: 800,
    fontSize: 13,
    margin: "0 0 3px",
    fontFamily: "'Syne', sans-serif",
  } satisfies CSSProperties,
  modeRowSubtitle: {
    color: "var(--jt-muted-text, #6b6490)",
    fontSize: 11,
    margin: 0,
    lineHeight: 1.4,
  } satisfies CSSProperties,
};
