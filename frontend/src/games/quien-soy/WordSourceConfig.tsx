import { S } from "../../theme/styles";
import { CATEGORIES } from "@juntada/quien-soy-data";

// "¿De dónde salen las palabras?" editor — shared by local mode's own setup
// screen and the online lobby's ConfigPanel, so both read identically.
// "categories": deal a word straight from the host's active category pool.
// "suggested": everyone writes a word for a random target and the group
// votes on it (see engine.ts's suggest/vote phases) — no category toggles
// needed in that mode.
export function WordSourceConfig({
  wordSource,
  activeCategories,
  onChange,
}: {
  wordSource: "categories" | "suggested";
  activeCategories: Record<string, boolean>;
  onChange: (patch: { wordSource?: "categories" | "suggested"; activeCategories?: Record<string, boolean> }) => void;
}) {
  return (
    <div>
      <div style={S.card}>
        <span style={S.label}>¿De dónde salen las palabras?</span>
        <p style={{ ...S.muted, margin: "0 0 10px", lineHeight: 1.4 }}>
          De categorías predefinidas, o que cada uno le escriba una palabra a otro jugador (al azar) y el grupo vote cuál usar.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onChange({ wordSource: "categories" })}
            style={{ ...S.btn(wordSource === "categories" ? "primary" : "ghost"), flex: 1, padding: "8px", fontSize: 13 }}
          >
            Categorías
          </button>
          <button
            onClick={() => onChange({ wordSource: "suggested" })}
            style={{ ...S.btn(wordSource === "suggested" ? "primary" : "ghost"), flex: 1, padding: "8px", fontSize: 13 }}
          >
            Sugeridas y votadas
          </button>
        </div>
      </div>

      {wordSource === "categories" && (
        <div style={S.card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={S.label}>Categorías</span>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => onChange({ activeCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: true }), {}) })}
                style={{
                  background: "none",
                  border: "none",
                  color: "#7F77DD",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "inherit",
                }}
              >
                Todas
              </button>
              <button
                onClick={() => onChange({ activeCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: false }), {}) })}
                style={{
                  background: "none",
                  border: "none",
                  color: "#7F77DD",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "inherit",
                }}
              >
                Ninguna
              </button>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
            {Object.entries(CATEGORIES).map(([k, cat]) => {
              const active = !!activeCategories[k];
              return (
                <button
                  key={k}
                  onClick={() => onChange({ activeCategories: { ...activeCategories, [k]: !active } })}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "10px 16px",
                    borderRadius: 999,
                    border: active ? "1px solid rgba(127,119,221,0.6)" : "1px solid rgba(255,255,255,0.12)",
                    background: active ? "linear-gradient(135deg,#7F77DD,#534AB7)" : "rgba(255,255,255,0.04)",
                    color: active ? "#fff" : "#9089c0",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
