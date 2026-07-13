import { useState, type CSSProperties } from "react";
import { S } from "../../theme/styles";
import { DEFAULT_CATEGORIES } from "@juntada/tutifruti-data";
import { Btn } from "../../components/Btn";
import type { ConfigPanelProps } from "../gameTypes";

interface Category {
  id: string;
  label: string;
  icon?: string;
}

const divider: CSSProperties = { borderTop: "1px solid rgba(255,255,255,0.08)", margin: "16px 0" };

// Host-only rules editor shown in the multiplayer lobby. One card per tab
// (not one card per question) so the panel reads as a single flowing area
// instead of a stack of disconnected boxes — sections inside are split with
// thin dividers rather than separate cards.
export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const [tab, setTab] = useState<"cats" | "rules">("rules");
  const [newCat, setNewCat] = useState("");
  const [showActive, setShowActive] = useState(false);
  const config = room.config as any;
  const customCategories: Category[] = config.customCategories || [];
  const customIds = new Set(customCategories.map(c => c.id));
  const allCategories: Category[] = [...DEFAULT_CATEGORIES, ...customCategories];
  const activeList = allCategories.filter(c => !!config.activeCategories?.[c.id]);
  const activeCount = activeList.length;

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
        {(["cats", "rules"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ ...S.btn(tab === t ? "primary" : "ghost"), flex: 1, padding: "8px", fontSize: 13 }}
          >
            {t === "cats" ? "Categorías" : "Reglas"}
          </button>
        ))}
      </div>

      <div style={divider} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: activeCount === 0 ? "#F09595" : "#e8e4f0" }}>
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
      {activeCount === 0 && (
        <p style={{ ...S.muted, margin: "6px 0 0", lineHeight: 1.4 }}>
          Andá a la pestaña "Categorías" para elegir de qué van a ser las palabras.
        </p>
      )}
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

          <div style={divider} />

          <span style={S.label}>Categorías</span>
          <p style={{ ...S.muted, margin: "0 0 14px", lineHeight: 1.4 }}>Tocá una categoría para activarla o desactivarla en la partida.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {allCategories.map(cat => {
              const active = !!config.activeCategories?.[cat.id];
              const custom = customIds.has(cat.id);
              return (
                <div
                  key={cat.id}
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
                    onClick={() => toggleCategory(cat.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: custom ? "10px 6px 10px 16px" : "10px 16px",
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
                  {custom && (
                    <button
                      onClick={() => removeCustomCategory(cat.id)}
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
            })}
          </div>
        </>
      )}
    </div>
  );
}
