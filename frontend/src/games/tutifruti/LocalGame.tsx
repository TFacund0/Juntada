import { useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { DEFAULT_CATEGORIES, LETTERS } from "@juntada/tutifruti-data";

interface Category {
  id: string;
  label: string;
  icon?: string;
}

const CATEGORIES = DEFAULT_CATEGORIES as Category[];

// Same reasoning as the online ConfigPanel: DEFAULT_CATEGORIES alone is well
// over 100 entries, too long a list to scroll through just to toggle one.
const CATEGORIES_PER_PAGE = 20;

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL GAME MODE — un solo dispositivo. Acá el juego no lleva puntaje ni
// respuestas: sólo sortea la letra y sugiere qué categorías completar en voz
// alta o en un papel, cada uno a su ritmo.
// ═══════════════════════════════════════════════════════════════════════════════

export function LocalGame() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    CATEGORIES.reduce((a, c, i) => ({ ...a, [c.id]: i < 3 }), {} as Record<string, boolean>),
  );
  const [letter, setLetter] = useState<string | null>(null);
  const [usedLetters, setUsedLetters] = useState<string[]>([]);
  const [page, setPage] = useState(0);

  const activeCats = CATEGORIES.filter(c => enabled[c.id]);
  const pageCount = Math.ceil(CATEGORIES.length / CATEGORIES_PER_PAGE);
  const currentPage = Math.min(page, pageCount - 1);
  const pagedCategories = CATEGORIES.slice(currentPage * CATEGORIES_PER_PAGE, (currentPage + 1) * CATEGORIES_PER_PAGE);

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
        {activeCats.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 16 }}>
            {activeCats.map(cat => (
              <span key={cat.id} style={S.pill(true)}>
                {cat.icon} {cat.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <Btn onClick={drawLetter}>{letter ? "🔀 Nueva letra" : "🎲 Sortear letra"}</Btn>

      <div style={{ ...S.card, marginTop: 16 }}>
        <span style={S.label}>Categorías sugeridas</span>
        <p style={{ ...S.muted, margin: "4px 0 14px", lineHeight: 1.4 }}>Tocá una categoría para activarla o desactivarla.</p>
        {pageCount > 1 && <PageNumbers pageCount={pageCount} currentPage={currentPage} onChange={setPage} />}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {pagedCategories.map(cat => {
            const active = !!enabled[cat.id];
            return (
              <button
                key={cat.id}
                onClick={() => setEnabled(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}
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
                  boxShadow: active ? "0 3px 14px rgba(127,119,221,0.35)" : "none",
                  transition: "all 0.15s",
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Numbered page picker (1, 2, 3, ...) instead of just prev/next arrows, so
// jumping straight to a page you already know is one tap instead of several.
function PageNumbers({ pageCount, currentPage, onChange }: { pageCount: number; currentPage: number; onChange: (page: number) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
      {Array.from({ length: pageCount }, (_, i) => i).map(i => (
        <button
          key={i}
          onClick={() => onChange(i)}
          style={{
            minWidth: 34,
            height: 34,
            padding: "0 4px",
            borderRadius: 8,
            border: i === currentPage ? "1px solid rgba(127,119,221,0.6)" : "1px solid rgba(255,255,255,0.12)",
            background: i === currentPage ? "linear-gradient(135deg,#7F77DD,#534AB7)" : "rgba(255,255,255,0.04)",
            color: i === currentPage ? "#fff" : "#9089c0",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}
