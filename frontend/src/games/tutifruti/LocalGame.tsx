import { useState } from "react";
import "./tutifruti.css";
import { S } from "../../theme/styles";
import { Btn } from "../../components/ui/Btn";
import { StickyActionBar, STICKY_ACTION_BAR_CLEARANCE } from "../../components/setup/StickyActionBar";
import { DEFAULT_CATEGORIES, LETTERS, COMMON_LETTERS } from "@juntada/tutifruti-data";
import { PageNumbers } from "./components/PageNumbers";
import { LetterReveal } from "./components/LetterReveal";
import { CategoryChip } from "./components/CategoryChip";

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
  // Pantalla "solo letra y categorías" — para cuando ya se terminó de armar
  // la configuración y el grupo solo quiere ver grande lo que hay que
  // completar, sin la lista de toggles de letras/categorías ocupando lugar.
  const [focusMode, setFocusMode] = useState(false);

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

  // Compartido entre la vista normal y el modo visualización — la letra, el
  // botón de sortear, y el aviso de "no hay letras activas" son exactamente
  // lo mismo en las dos, solo cambia qué más se muestra alrededor.
  const letterBlock = (
    <>
      <LetterReveal
        letter={letter}
        label={letter ? "La letra es..." : "Tocá para sortear una letra"}
        size="hero"
        footer={
          activeCats.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 28 }}>
              {activeCats.map(cat => (
                <span key={cat.id} style={S.pill(true)}>
                  {cat.icon} {cat.label}
                </span>
              ))}
            </div>
          )
        }
      />
      <Btn onClick={drawLetter} disabled={activeLetters.length === 0} style={{ marginTop: 10 }}>
        {letter ? "🔀 Nueva letra" : "🎲 Sortear letra"}
      </Btn>
      {activeLetters.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--jt-warn-text, #E2C44A)", textAlign: "center", marginTop: 8 }}>
          Activá al menos una letra abajo para poder sortear.
        </p>
      )}
    </>
  );

  if (focusMode) {
    return (
      <div style={{ paddingBottom: STICKY_ACTION_BAR_CLEARANCE }}>
        <div className="tf-setup-stage">
          <div className="tf-setup-hero-wrap">{letterBlock}</div>
        </div>
        <StickyActionBar>
          <Btn variant="ghost" onClick={() => setFocusMode(false)}>
            ⚙️ Editar configuración
          </Btn>
        </StickyActionBar>
      </div>
    );
  }

  return (
    <div>
      {letterBlock}
      <Btn variant="ghost" onClick={() => setFocusMode(true)} style={{ marginTop: 10 }}>
        👁️ Solo letra y categorías
      </Btn>

      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={S.label}>Letras</span>
          <span style={{ fontSize: 12, color: "var(--jt-muted-text, #9089c0)", fontWeight: 700 }}>
            {activeLetters.length} activa{activeLetters.length === 1 ? "" : "s"}
          </span>
        </div>
        <p style={{ ...S.muted, margin: "4px 0 14px", lineHeight: 1.4 }}>
          Tocá una letra para activarla o desactivarla — ya vienen preseleccionadas las más comunes.
        </p>
        <div className="tf-letter-grid">
          {(LETTERS as string[]).map(l => {
            const active = !!enabledLetters[l];
            return (
              <button
                key={l}
                onClick={() => setEnabledLetters(prev => ({ ...prev, [l]: !prev[l] }))}
                className="jt-btn-anim"
                style={{
                  height: 40,
                  borderRadius: 10,
                  border: active ? "1px solid var(--jt-accent-border-soft, rgba(127,119,221,0.6))" : "1px solid rgba(255,255,255,0.12)",
                  background: active
                    ? "linear-gradient(135deg, var(--jt-accent, #7F77DD), var(--jt-accent-strong, #534AB7))"
                    : "rgba(255,255,255,0.04)",
                  color: active ? "#fff" : "var(--jt-muted-text, #9089c0)",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: active ? "0 3px 14px var(--jt-accent-border-soft, rgba(127,119,221,0.35))" : "none",
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
          <span style={{ fontSize: 12, color: "var(--jt-muted-text, #9089c0)", fontWeight: 700 }}>
            {activeCats.length} activa{activeCats.length === 1 ? "" : "s"}
          </span>
        </div>
        <p style={{ ...S.muted, margin: "4px 0 14px", lineHeight: 1.4 }}>Tocá una categoría para activarla o desactivarla.</p>
        {activeCats.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--jt-warn-text, #E2C44A)", margin: "0 0 14px" }}>
            No hay ninguna categoría activa — no van a tener nada sugerido para completar con la letra.
          </p>
        )}
        {pageCount > 1 && <PageNumbers pageCount={pageCount} currentPage={currentPage} onChange={setPage} />}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {pagedCategories.map(cat => (
            <CategoryChip
              key={cat.id}
              cat={cat}
              active={!!enabled[cat.id]}
              onToggle={() => setEnabled(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
