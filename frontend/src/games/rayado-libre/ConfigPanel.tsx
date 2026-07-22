import { S } from "../../theme/styles";
import { CATEGORIES } from "@juntada/rayado-libre-data";
import type { ConfigPanelProps } from "../gameTypes";

export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const config = room.config as { enabledCategories?: Record<string, boolean>; totalRounds?: number };
  const activeCount = Object.values(config.enabledCategories || {}).filter(Boolean).length;

  return (
    <div>
      <div style={S.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={S.label}>Categorías</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => updateConfig({ enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: true }), {}) })}
              style={{ background: "none", border: "none", color: "#7F77DD", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}
            >
              Todas
            </button>
            <button
              onClick={() => updateConfig({ enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: false }), {}) })}
              style={{ background: "none", border: "none", color: "#7F77DD", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}
            >
              Ninguna
            </button>
          </div>
        </div>
        <p style={{ ...S.muted, margin: "4px 0 14px", lineHeight: 1.4 }}>Palabras de qué categorías se ofrecen para dibujar.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {Object.entries(CATEGORIES).map(([k, cat]) => {
            const active = !!config.enabledCategories?.[k];
            return (
              <button
                key={k}
                onClick={() => updateConfig({ enabledCategories: { ...config.enabledCategories, [k]: !active } })}
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
        <p style={{ ...S.muted, marginTop: 14 }}>
          {activeCount === 0 ? "No elegiste ninguna categoría todavía." : `${activeCount} categoría${activeCount === 1 ? "" : "s"} activa${activeCount === 1 ? "" : "s"}.`}
        </p>
      </div>

      <div style={S.card}>
        <span style={S.label}>Vueltas: cada jugador dibuja {config.totalRounds ?? 3} {(config.totalRounds ?? 3) === 1 ? "vez" : "veces"}</span>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => updateConfig({ totalRounds: n })}
              style={{ ...S.btn((config.totalRounds ?? 3) === n ? "primary" : "ghost"), flex: 1, padding: "8px", fontSize: 13 }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
