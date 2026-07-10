// ─── Design tokens / inline-style dictionary ─────────────────────────────────
export const S = {
  app: { minHeight: "100vh", background: "#0f0c1d", fontFamily: "'Syne', sans-serif", color: "#e8e4f0", overflowX: "hidden" },
  wrap: { maxWidth: 480, margin: "0 auto", padding: "0 16px 60px" },
  header: { textAlign: "center", padding: "32px 0 20px", borderBottom: "1px solid rgba(127,119,221,0.2)", marginBottom: 24 },
  title: { fontSize: 38, fontWeight: 800, letterSpacing: "-0.03em", background: "linear-gradient(90deg,#AFA9EC,#5DCAA5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(127,119,221,0.18)", borderRadius: 16, padding: "18px 20px", marginBottom: 14 },
  cardHighlight: { background: "rgba(127,119,221,0.1)", border: "1px solid rgba(127,119,221,0.35)", borderRadius: 16, padding: "18px 20px", marginBottom: 14 },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7F77DD", marginBottom: 10, display: "block" },
  input: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(127,119,221,0.25)", borderRadius: 10, padding: "11px 14px", color: "#e8e4f0", fontSize: 15, fontFamily: "inherit", width: "100%", outline: "none", boxSizing: "border-box" },
  btn: (variant = "primary", disabled = false) => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "13px 28px", borderRadius: 12, fontWeight: 700, fontSize: 15,
    cursor: disabled ? "default" : "pointer", border: "none", transition: "all 0.15s",
    fontFamily: "inherit", width: "100%", boxSizing: "border-box",
    opacity: disabled ? 0.4 : 1,
    ...(variant === "primary" ? { background: "linear-gradient(135deg,#7F77DD,#534AB7)", color: "#fff", boxShadow: disabled ? "none" : "0 4px 20px rgba(127,119,221,0.35)" }
      : variant === "success" ? { background: "linear-gradient(135deg,#1D9E75,#0F6E56)", color: "#fff", boxShadow: disabled ? "none" : "0 4px 20px rgba(29,158,117,0.3)" }
      : variant === "danger" ? { background: "rgba(226,75,74,0.15)", color: "#F09595", border: "1px solid rgba(226,75,74,0.3)" }
      : { background: "rgba(127,119,221,0.1)", color: "#AFA9EC", border: "1px solid rgba(127,119,221,0.25)" }),
  }),
  bigReveal: { fontSize: 28, fontWeight: 800, color: "#AFA9EC", textAlign: "center", letterSpacing: "-0.02em", margin: "12px 0", lineHeight: 1.2 },
  muted: { color: "#6b6490", fontSize: 13 },
  pill: (on) => ({
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
    background: on ? "rgba(29,158,117,0.15)" : "rgba(255,255,255,0.06)",
    color: on ? "#5DCAA5" : "#6b6490",
    border: `1px solid ${on ? "rgba(29,158,117,0.35)" : "rgba(255,255,255,0.08)"}`,
  }),
  toggle: (on) => ({
    width: 44, height: 24, borderRadius: 12, position: "relative", flexShrink: 0,
    background: on ? "rgba(29,158,117,0.8)" : "rgba(255,255,255,0.1)",
    border: `1px solid ${on ? "rgba(29,158,117,0.5)" : "rgba(255,255,255,0.1)"}`,
    cursor: "pointer", transition: "background 0.2s",
  }),
  knob: (on) => ({
    position: "absolute", top: 2, left: on ? 22 : 2, width: 18, height: 18,
    borderRadius: "50%", background: "#fff", transition: "left 0.2s",
    boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
  }),
};
