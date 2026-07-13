import { useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { Toggle } from "../../components/Toggle";
import { DEFAULT_CATEGORIES, LETTERS } from "@juntada/tutifruti-data";

interface Category {
  id: string;
  label: string;
  icon?: string;
}

const CATEGORIES = DEFAULT_CATEGORIES as Category[];

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL GAME MODE — un solo dispositivo. Acá el juego no lleva puntaje ni
// respuestas: sólo sortea la letra y sugiere qué categorías completar en voz
// alta o en un papel, cada uno a su ritmo.
// ═══════════════════════════════════════════════════════════════════════════════

export function LocalGame() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    CATEGORIES.reduce((a, c) => ({ ...a, [c.id]: true }), {} as Record<string, boolean>),
  );
  const [letter, setLetter] = useState<string | null>(null);
  const [usedLetters, setUsedLetters] = useState<string[]>([]);

  const activeCats = CATEGORIES.filter(c => enabled[c.id]);

  const drawLetter = () => {
    let available = (LETTERS as string[]).filter(l => !usedLetters.includes(l));
    if (available.length === 0) {
      available = LETTERS as string[];
      setUsedLetters([]);
    }
    const picked = available[Math.floor(Math.random() * available.length)];
    setLetter(picked);
    setUsedLetters(prev => [...prev, picked]);
  };

  return (
    <div>
      <div style={{ ...S.cardHighlight, textAlign: "center", padding: "36px 20px" }}>
        <p style={{ fontSize: 13, color: "#9089c0", marginBottom: 8 }}>{letter ? "La letra es..." : "Tocá para sortear una letra"}</p>
        <p style={{ fontSize: 64, fontWeight: 800, color: "#AFA9EC", margin: 0, lineHeight: 1 }}>{letter || "?"}</p>
      </div>
      <Btn onClick={drawLetter}>{letter ? "🔀 Nueva letra" : "🎲 Sortear letra"}</Btn>

      <div style={{ ...S.card, marginTop: 16 }}>
        <span style={S.label}>Categorías sugeridas</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CATEGORIES.map(cat => (
            <Toggle
              key={cat.id}
              label={`${cat.icon} ${cat.label}`}
              value={!!enabled[cat.id]}
              onChange={v => setEnabled(prev => ({ ...prev, [cat.id]: v }))}
            />
          ))}
        </div>
      </div>

      {letter && activeCats.length > 0 && (
        <div style={S.card}>
          <span style={S.label}>A completar con la "{letter}"</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {activeCats.map(cat => (
              <span key={cat.id} style={S.pill(true)}>
                {cat.icon} {cat.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
