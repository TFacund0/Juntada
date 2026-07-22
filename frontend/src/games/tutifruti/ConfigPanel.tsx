import { useState, type CSSProperties } from "react";
import { S } from "../../theme/styles";
import { DEFAULT_CATEGORIES, LETTERS } from "@juntada/tutifruti-data";
import { Btn } from "../../components/Btn";
import type { ConfigPanelProps } from "../gameTypes";

interface Category {
  id: string;
  label: string;
  icon?: string;
}

const divider: CSSProperties = { borderTop: "1px solid rgba(255,255,255,0.08)", margin: "16px 0" };

// DEFAULT_CATEGORIES alone is well over 100 entries — showing them all in one
// long wrapping list meant scrolling a long way down just to find one to
// toggle. Paged instead, same idea as a search results list.
const CATEGORIES_PER_PAGE = 20;

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

function CategoryChip({ cat, active, onToggle, onRemove }: { cat: Category; active: boolean; onToggle: () => void; onRemove?: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        borderRadius: 999,
        border: active ? "1px solid rgba(127,119,221,0.6)" : "1px solid rgba(255,255,255,0.12)",
        background: active ? "linear-gradient(135deg,#7F77DD,#534AB7)" : "rgba(255,255,255,0.04)",
        boxShadow: active ? "0 3px 14px rgba(127,119,221,0.35)" : "none",
        transition: "all 0.15s",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: onRemove ? "10px 6px 10px 16px" : "10px 16px",
          border: "none",
          background: "none",
          color: active ? "#fff" : "#9089c0",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {cat.icon && <span>{cat.icon}</span>}
        <span>{cat.label}</span>
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Quitar ${cat.label}`}
          style={{
            border: "none",
            background: "none",
            color: active ? "rgba(255,255,255,0.7)" : "#6b6490",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 15,
            fontWeight: 700,
            padding: "10px 14px 10px 4px",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// Host-only rules editor shown in the multiplayer lobby. One card per tab
// (not one card per question) so the panel reads as a single flowing area
// instead of a stack of disconnected boxes — sections inside are split with
// thin dividers rather than separate cards.
export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const [tab, setTab] = useState<"cats" | "rules" | "letters">("rules");
  const [newCat, setNewCat] = useState("");
  const [showActive, setShowActive] = useState(false);
  const [page, setPage] = useState(0);
  const config = room.config as any;
  const customCategories: Category[] = config.customCategories || [];
  const customIds = new Set(customCategories.map(c => c.id));
  const allCategories: Category[] = [...DEFAULT_CATEGORIES, ...customCategories];
  const activeList = allCategories.filter(c => !!config.activeCategories?.[c.id]);
  const activeCount = activeList.length;
  const activeLetterCount = (LETTERS as string[]).filter(l => !!config.enabledLetters?.[l]).length;

  const toggleLetter = (l: string) => {
    updateConfig({ enabledLetters: { ...config.enabledLetters, [l]: !config.enabledLetters?.[l] } });
  };

  const pageCount = Math.ceil(DEFAULT_CATEGORIES.length / CATEGORIES_PER_PAGE);
  const currentPage = Math.min(page, pageCount - 1);
  const pagedCategories = DEFAULT_CATEGORIES.slice(currentPage * CATEGORIES_PER_PAGE, (currentPage + 1) * CATEGORIES_PER_PAGE);

  const addCustomCategory = () => {
    const label = newCat.trim();
    if (!label) return;
    const id = `custom_${Date.now()}`;
    updateConfig({
      customCategories: [...customCategories, { id, label }],
      activeCategories: { ...config.activeCategories, [id]: true },
    });
    setNewCat("");
  };

  const removeCustomCategory = (id: string) => {
    updateConfig({ customCategories: customCategories.filter(c => c.id !== id) });
  };

  const toggleCategory = (id: string) => {
    updateConfig({ activeCategories: { ...config.activeCategories, [id]: !config.activeCategories?.[id] } });
  };

  return (
    <div style={S.card}>
      <span style={S.label}>Configuración</span>
      <div style={{ display: "flex", gap: 8 }}>
        {(["cats", "letters", "rules"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ ...S.btn(tab === t ? "primary" : "ghost"), flex: 1, padding: "8px", fontSize: 13 }}
          >
            {t === "cats" ? "Categorías" : t === "letters" ? "Letras" : "Reglas"}
          </button>
        ))}
      </div>

      <div style={divider} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#e8e4f0" }}>
          {activeCount === 0 ? "Ninguna categoría activa" : `${activeCount} categoría${activeCount === 1 ? "" : "s"} activa${activeCount === 1 ? "" : "s"}`}
        </span>
        {activeCount > 0 && (
          <button
            onClick={() => setShowActive(v => !v)}
            style={{ background: "none", border: "none", color: "#7F77DD", cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 700 }}
          >
            {showActive ? "Ocultar" : "Ver cuáles"}
          </button>
        )}
      </div>
      {showActive && activeCount > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {activeList.map(c => (
            <span key={c.id} style={S.pill(true)}>
              {c.icon} {c.label}
            </span>
          ))}
        </div>
      )}

      {tab === "rules" && (
        <>
          <div style={divider} />

          <span style={S.label}>Rondas: {config.rounds}</span>
          <p style={{ ...S.muted, margin: "4px 0 8px", lineHeight: 1.4 }}>Cuántas rondas se juegan en total.</p>
          <input
            type="range"
            min="1"
            max="15"
            step="1"
            value={config.rounds}
            onChange={e => updateConfig({ rounds: +e.target.value })}
            style={{ width: "100%" }}
          />

          <div style={divider} />

          <span style={S.label}>¿Cómo termina la ronda?</span>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              onClick={() => updateConfig({ endMode: "timer" })}
              style={{ ...S.btn(config.endMode === "timer" ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
            >
              Por tiempo
            </button>
            <button
              onClick={() => updateConfig({ endMode: "basta" })}
              style={{ ...S.btn(config.endMode === "basta" ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
            >
              Por "¡Basta!"
            </button>
          </div>
          <p style={{ ...S.muted, marginTop: 10, lineHeight: 1.4 }}>
            {config.endMode === "basta"
              ? "La ronda termina apenas alguien complete todas las categorías y grite '¡Basta!'."
              : "La ronda termina cuando se acaba el tiempo, sin importar quién haya terminado."}
          </p>

          <div style={divider} />

          <span style={S.label}>Tiempo por ronda: {config.endMode === "basta" ? "No aplica" : `${config.roundTime}s`}</span>
          <p style={{ ...S.muted, margin: "4px 0 8px", lineHeight: 1.4 }}>Cuánto dura cada ronda antes de cortar.</p>
          <input
            type="range"
            min="30"
            max="240"
            step="15"
            value={config.roundTime}
            disabled={config.endMode === "basta"}
            onChange={e => updateConfig({ roundTime: +e.target.value })}
            style={{ width: "100%", opacity: config.endMode === "basta" ? 0.4 : 1 }}
          />
        </>
      )}

      {tab === "cats" && (
        <>
          <div style={divider} />

          <span style={S.label}>Agregar categoría</span>
          <p style={{ ...S.muted, margin: "4px 0 12px", lineHeight: 1.4 }}>Sumá una categoría propia, además de las de abajo.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...S.input, flex: 1 }}
              placeholder="Nueva categoría..."
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") addCustomCategory();
              }}
            />
            <Btn variant="ghost" onClick={addCustomCategory} style={{ width: "auto", padding: "11px 18px" }}>
              Agregar
            </Btn>
          </div>

          {customCategories.length > 0 && (
            <>
              <div style={divider} />
              <span style={S.label}>Tus categorías</span>
              <p style={{ ...S.muted, margin: "0 0 14px", lineHeight: 1.4 }}>Las que agregaste vos, siempre a mano sin importar la página.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {customCategories.map(cat => (
                  <CategoryChip
                    key={cat.id}
                    cat={cat}
                    active={!!config.activeCategories?.[cat.id]}
                    onToggle={() => toggleCategory(cat.id)}
                    onRemove={() => removeCustomCategory(cat.id)}
                  />
                ))}
              </div>
            </>
          )}

          <div style={divider} />

          <span style={S.label}>Categorías</span>
          <p style={{ ...S.muted, margin: "4px 0 14px", lineHeight: 1.4 }}>Tocá una categoría para activarla o desactivarla en la partida.</p>
          {pageCount > 1 && <PageNumbers pageCount={pageCount} currentPage={currentPage} onChange={setPage} />}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {pagedCategories.map(cat => (
              <CategoryChip key={cat.id} cat={cat} active={!!config.activeCategories?.[cat.id]} onToggle={() => toggleCategory(cat.id)} />
            ))}
          </div>
        </>
      )}

      {tab === "letters" && (
        <>
          <div style={divider} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={S.label}>Letras</span>
            <span style={{ fontSize: 12, color: "#9089c0", fontWeight: 700 }}>
              {activeLetterCount} activa{activeLetterCount === 1 ? "" : "s"}
            </span>
          </div>
          <p style={{ ...S.muted, margin: "4px 0 14px", lineHeight: 1.4 }}>
            Tocá una letra para activarla o desactivarla — ya vienen preseleccionadas las más comunes.
          </p>
          {activeLetterCount === 0 && (
            <p style={{ fontSize: 12, color: "#E2C44A", margin: "0 0 14px" }}>Activá al menos una letra para poder empezar una ronda.</p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(LETTERS as string[]).map(l => {
              const active = !!config.enabledLetters?.[l];
              return (
                <button
                  key={l}
                  onClick={() => toggleLetter(l)}
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
        </>
      )}
    </div>
  );
}
