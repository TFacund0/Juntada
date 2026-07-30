import { S } from "../../../theme/styles";
import { CATEGORIES } from "@juntada/rayado-libre-data";

interface CategoryPickerProps {
  enabled: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  /** Texto opcional entre el encabezado y la grilla de chips (p. ej. la aclaración del lobby online). */
  description?: string;
}

const linkButtonStyle = {
  background: "none",
  border: "none",
  color: "#7F77DD",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "inherit",
} as const;

/**
 * Selector de categorías activas: encabezado con atajos "Todas"/"Ninguna" y
 * la grilla de chips, una por categoría.
 *
 * Compartido entre el modo local (`LocalGame`, pestaña de configuración) y
 * el modo online (`ConfigPanel`, lobby) — antes era el mismo bloque de JSX
 * duplicado en los dos archivos, solo cambiaba cómo se guardaba el cambio
 * (`setState` local vs `updateConfig` de la sala).
 *
 * @param enabled Mapa de categoría → si está activa.
 * @param onChange Reemplazo completo del mapa de categorías activas.
 */
export function CategoryPicker({ enabled, onChange, description }: CategoryPickerProps) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={S.label}>Categorías</span>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => onChange(Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: true }), {}))} style={linkButtonStyle}>
            Todas
          </button>
          <button onClick={() => onChange(Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: false }), {}))} style={linkButtonStyle}>
            Ninguna
          </button>
        </div>
      </div>
      {description && <p style={{ ...S.muted, margin: "4px 0 14px", lineHeight: 1.4 }}>{description}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
        {Object.entries(CATEGORIES).map(([k, cat]) => {
          const active = !!enabled[k];
          return (
            <button
              key={k}
              onClick={() => onChange({ ...enabled, [k]: !active })}
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
    </>
  );
}
