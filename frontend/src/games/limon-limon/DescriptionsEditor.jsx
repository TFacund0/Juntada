import { useState } from "react";
import { S } from "../../theme/styles";
import { SUITS, VALUES, cardKey, valueLabel, suitInfo } from "./deck";
import { SuitGlyph } from "./SuitGlyph";

// Cada carta (número + palo) puede tener un significado propio — 40 en
// total — así que se editan agrupadas por palo en pestañas para que no se
// amontonen. Es solo informativo: durante la ronda el grupo elige siempre a
// mano quién come cada carta.
export function DescriptionsEditor({ descriptions, onChange }) {
  const [tab, setTab] = useState(SUITS[0].id);
  const activeSuit = suitInfo(tab);

  return (
    <div style={S.card}>
      <span style={S.label}>Significado de cada carta (editable)</span>
      <p style={{ ...S.muted, marginTop: -6, marginBottom: 14 }}>
        Cada carta (número y palo) puede tener un significado distinto. Es solo una referencia — quién come cada carta se elige siempre manualmente.
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {SUITS.map(s => (
          <button
            key={s.id}
            onClick={() => setTab(s.id)}
            style={{ ...S.btn(tab === s.id ? "primary" : "secondary"), flex: 1, padding: "8px 4px", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <svg width={14} height={14} viewBox="-8 -8 16 16"><SuitGlyph suit={s.id} /></svg>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {VALUES.map(value => {
          const key = cardKey(tab, value);
          return (
            <div key={key}>
              <span style={{ fontSize: 12, fontWeight: 700, color: activeSuit.color, marginBottom: 4, display: "block" }}>
                {valueLabel(value)} de {activeSuit.label}
              </span>
              <input
                style={{ ...S.input, fontSize: 13 }}
                value={descriptions[key] || ""}
                onChange={e => onChange(key, e.target.value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
