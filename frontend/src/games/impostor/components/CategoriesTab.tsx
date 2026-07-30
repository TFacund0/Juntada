import { S } from "../../../theme/styles";
import { CATEGORIES } from "@juntada/impostor-data";

interface CategoriesTabProps {
  enabledCategories: Record<string, boolean>;
  usedWords: Record<string, string[]>;
  onChange: (enabledCategories: Record<string, boolean>) => void;
}

// The "Categorías" config tab — identical between LocalGame and ConfigPanel
// (online), just wired to a different write path (local React state vs a
// patch sent to the server). Bulk-select buttons, one chip per category
// (toggle + remaining-words count), and a summary/exhausted warning below.
export function CategoriesTab({ enabledCategories, usedWords, onChange }: CategoriesTabProps) {
  const activeKeys = Object.keys(enabledCategories || {}).filter(k => enabledCategories[k]);
  const wordsLeftIn = (catKey: string) => CATEGORIES[catKey].words.length - (usedWords[catKey] || []).length;
  const allCategoriesExhausted = activeKeys.length > 0 && activeKeys.every(k => wordsLeftIn(k) <= 0);

  return (
    <div style={S.card}>
      <span style={S.label}>Categorías</span>
      <p style={{ ...S.muted, margin: "4px 0 12px", lineHeight: 1.4 }}>
        Elegí de qué van a ser las palabras. Tocá una categoría para activarla.
      </p>
      <style>{`
        .impostor-cats-bulk-btn {
          transition: transform 0.1s ease-out, filter 0.15s ease-out, box-shadow 0.15s ease-out;
        }
        .impostor-cats-bulk-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.25);
        }
        .impostor-cats-bulk-btn:active {
          transform: scale(0.96);
        }
      `}</style>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button
          className="impostor-cats-bulk-btn"
          onClick={() => onChange(Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: true }), {}))}
          style={{
            flex: 1,
            background: "rgba(224,32,43,0.12)",
            border: "1px solid rgba(224,32,43,0.4)",
            borderRadius: 8,
            color: "#FF6B6B",
            cursor: "pointer",
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "inherit",
          }}
        >
          ✓ Seleccionar todas
        </button>
        <button
          className="impostor-cats-bulk-btn"
          onClick={() => onChange(Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: false }), {}))}
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 8,
            color: "var(--jt-muted-text)",
            cursor: "pointer",
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "inherit",
          }}
        >
          ✕ Quitar todas
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {Object.entries(CATEGORIES).map(([k, cat]) => {
          const active = !!enabledCategories?.[k];
          const remaining = wordsLeftIn(k);
          const exhausted = remaining <= 0;
          return (
            <button
              key={k}
              onClick={() => onChange({ ...enabledCategories, [k]: !active })}
              title={exhausted ? "Ya se usaron todas las palabras de esta categoría en esta partida" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 16px",
                borderRadius: 999,
                border: active ? "1px solid rgba(224,32,43,0.6)" : "1px solid rgba(255,255,255,0.12)",
                background: active ? "linear-gradient(135deg,#E0202B,#7A1A20)" : "rgba(255,255,255,0.04)",
                color: active ? "#fff" : "var(--jt-muted-text)",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: active ? "0 3px 14px rgba(224,32,43,0.35)" : "none",
                transition: "all 0.15s",
                opacity: exhausted ? 0.55 : 1,
              }}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span style={{ fontSize: 11, opacity: 0.75 }}>{exhausted ? "· sin palabras" : `· ${remaining}`}</span>
            </button>
          );
        })}
      </div>
      <p style={{ ...S.muted, marginTop: 14 }}>
        {activeKeys.length === 0
          ? "No elegiste ninguna categoría todavía."
          : `${activeKeys.length} categoría${activeKeys.length === 1 ? "" : "s"} activa${activeKeys.length === 1 ? "" : "s"}.`}
      </p>
      {allCategoriesExhausted && (
        <p style={{ fontSize: 12, color: "#F09595", marginTop: 4 }}>
          Ya se usaron todas las palabras de las categorías activas — activá otra para poder seguir jugando.
        </p>
      )}
    </div>
  );
}
