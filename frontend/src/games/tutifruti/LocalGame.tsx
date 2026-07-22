import { useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { DEFAULT_CATEGORIES, LETTERS, COMMON_LETTERS } from "@juntada/tutifruti-data";

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
  // Same idea as the online ConfigPanel: preselect the letters that usually
  // have live words in most categories, leave the rest (Ñ, K, Q, W, X, Y, Z,
  // plus a few borderline ones) off by default but still toggleable.
  const [enabledLetters, setEnabledLetters] = useState<Record<string, boolean>>(() =>
    (LETTERS as string[]).reduce((a, l) => ({ ...a, [l]: (COMMON_LETTERS as string[]).includes(l) }), {} as Record<string, boolean>),
  );
  const [letter, setLetter] = useState<string | null>(null);
  const [usedLetters, setUsedLetters] = useState<string[]>([]);
  const [page, setPage] = useState(0);

  const activeCats = CATEGORIES.filter(c => enabled[c.id]);
  const activeLetters = (LETTERS as string[]).filter(l => enabledLetters[l]);
  const pageCount = Math.ceil(CATEGORIES.length / CATEGORIES_PER_PAGE);
  const currentPage = Math.min(page, pageCount - 1);
  const pagedCategories = CATEGORIES.slice(currentPage * CATEGORIES_PER_PAGE, (currentPage + 1) * CATEGORIES_PER_PAGE);

  const drawLetter = () => {
    if (activeLetters.length === 0) return;
    let available = activeLetters.filter(l => !usedLetters.includes(l));
    if (available.length === 0) {
      available = activeLetters;
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
      <Btn onClick={drawLetter} disabled={activeLetters.length === 0}>
        {letter ? "🔀 Nueva letra" : "🎲 Sortear letra"}
      </Btn>
      {activeLetters.length === 0 && (
        <p style={{ fontSize: 12, color: "#E2C44A", textAlign: "center", marginTop: 8 }}>
          Activá al menos una letra abajo para poder sortear.
        </p>
      )}

      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={S.label}>Letras</span>
          <span style={{ fontSize: 12, color: "#9089c0", fontWeight: 700 }}>
            {activeLetters.length} activa{activeLetters.length === 1 ? "" : "s"}
          </span>
        </div>
        <p style={{ ...S.muted, margin: "4px 0 14px", lineHeight: 1.4 }}>
          Tocá una letra para activarla o desactivarla — ya vienen preseleccionadas las más comunes.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(LETTERS as string[]).map(l => {
            const active = !!enabledLetters[l];
            return (
              <button
                key={l}
                onClick={() => setEnabledLetters(prev => ({ ...prev, [l]: !prev[l] }))}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: active ? "1px solid rgba(127,119,221,0.6)" : "1px solid rgba(255,255,255,0.12)",
                  background: active ? "linear-gradient(135deg,#7F77DD,#534AB7)" : "rgba(255,255,255,0.04)",
                  color: active ? "#fff" : "#9089c0",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: active ? "0 3px 14px rgba(127,119,221,0.35)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={S.label}>Categorías sugeridas</span>
          <span style={{ fontSize: 12, color: "#9089c0", fontWeight: 700 }}>
            {activeCats.length} activa{activeCats.length === 1 ? "" : "s"}
          </span>
        </div>
        <p style={{ ...S.muted, margin: "4px 0 14px", lineHeight: 1.4 }}>Tocá una categoría para activarla o desactivarla.</p>
        {activeCats.length === 0 && (
          <p style={{ fontSize: 12, color: "#E2C44A", margin: "0 0 14px" }}>
            No hay ninguna categoría activa — no van a tener nada sugerido para completar con la letra.
          </p>
        )}
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
