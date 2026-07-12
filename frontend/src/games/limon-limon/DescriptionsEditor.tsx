import { useState, useRef, useEffect } from "react";
import { S } from "../../theme/styles";
import { SUITS, VALUES, cardKey, valueLabel, suitInfo } from "./deck";
import { SuitGlyph } from "./SuitGlyph";

const MAX_LENGTH = 300;
const COMMIT_DELAY_MS = 400;

interface DescriptionsEditorProps {
  descriptions: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

// Cada carta (número + palo) puede tener un significado propio — 40 en
// total — así que se editan agrupadas por palo en pestañas para que no se
// amontonen. Es solo informativo: durante la ronda el grupo elige siempre a
// mano quién come cada carta.
//
// En el modo online, cada onChange termina mandando la config completa de la
// sala a todos los jugadores conectados — hacerlo en cada tecla sería un
// mensaje y un re-render de sala entera por carácter tipeado. Por eso el
// input se actualiza al toque (para que se sienta responsive) pero recién
// dispara `onChange` (y con eso el broadcast) unos milisegundos después de
// que la persona deja de tipear ese campo.
export function DescriptionsEditor({ descriptions, onChange }: DescriptionsEditorProps) {
  const [tab, setTab] = useState(SUITS[0].id);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const activeSuit = suitInfo(tab);

  useEffect(
    () => () => {
      Object.values(timers.current).forEach(clearTimeout);
    },
    [],
  );

  const handleInput = (key: string, value: string) => {
    setDrafts(d => ({ ...d, [key]: value }));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      onChange(key, value);
      setDrafts(d => {
        const { [key]: _discard, ...rest } = d;
        return rest;
      });
    }, COMMIT_DELAY_MS);
  };

  return (
    <div style={S.card}>
      <span style={S.label}>Significado de cada carta (editable)</span>
      <p style={{ ...S.muted, marginTop: -6, marginBottom: 14 }}>
        Cada carta (número y palo) puede tener un significado distinto. Es solo una referencia — quién come cada carta se elige siempre
        manualmente.
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {SUITS.map(s => (
          <button
            key={s.id}
            onClick={() => setTab(s.id)}
            style={{
              ...S.btn(tab === s.id ? "primary" : "ghost"),
              flex: 1,
              padding: "8px 4px",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <svg width={14} height={14} viewBox="-8 -8 16 16">
              <SuitGlyph suit={s.id} />
            </svg>
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
                maxLength={MAX_LENGTH}
                value={drafts[key] ?? descriptions[key] ?? ""}
                onChange={e => handleInput(key, e.target.value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
