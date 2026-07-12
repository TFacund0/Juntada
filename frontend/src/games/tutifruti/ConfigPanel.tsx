import { useState } from "react";
import { S } from "../../theme/styles";
import { DEFAULT_CATEGORIES } from "@juntada/tutifruti-data";
import { Toggle } from "../../components/Toggle";
import { Btn } from "../../components/Btn";
import type { ConfigPanelProps } from "../gameTypes";

interface Category {
  id: string;
  label: string;
  icon?: string;
}

// Host-only rules editor shown in the multiplayer lobby.
export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const [tab, setTab] = useState<"cats" | "rules">("cats");
  const [newCat, setNewCat] = useState("");
  const config = room.config as any;
  const customCategories: Category[] = config.customCategories || [];

  const addCustomCategory = () => {
    const label = newCat.trim();
    if (!label) return;
    const id = `custom_${Date.now()}`;
    updateConfig({ customCategories: [...customCategories, { id, label }] });
    setNewCat("");
  };

  const removeCustomCategory = (id: string) => {
    updateConfig({ customCategories: customCategories.filter(c => c.id !== id) });
  };

  return (
    <div style={S.card}>
      <span style={S.label}>Configuración</span>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
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

      {tab === "rules" && (
        <>
          <div style={{ marginBottom: 14 }}>
            <span style={S.label}>Rondas: {config.rounds}</span>
            <input
              type="range"
              min="1"
              max="15"
              step="1"
              value={config.rounds}
              onChange={e => updateConfig({ rounds: +e.target.value })}
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={S.label}>Cómo termina la ronda</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => updateConfig({ endMode: "timer" })}
                style={{ ...S.btn(config.endMode === "timer" ? "primary" : "ghost"), flex: 1, padding: "8px", fontSize: 13 }}
              >
                Por tiempo
              </button>
              <button
                onClick={() => updateConfig({ endMode: "basta" })}
                style={{ ...S.btn(config.endMode === "basta" ? "primary" : "ghost"), flex: 1, padding: "8px", fontSize: 13 }}
              >
                Por "¡Basta!"
              </button>
            </div>
          </div>
          <div>
            <span style={S.label}>Tiempo por ronda: {config.endMode === "basta" ? "No aplica" : `${config.roundTime}s`}</span>
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
          </div>
        </>
      )}

      {tab === "cats" && (
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {DEFAULT_CATEGORIES.map((cat: Category) => (
              <Toggle
                key={cat.id}
                label={`${cat.icon} ${cat.label}`}
                value={!!config.activeCategories[cat.id]}
                onChange={v => updateConfig({ activeCategories: { ...config.activeCategories, [cat.id]: v } })}
              />
            ))}
          </div>
          {customCategories.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <span style={S.label}>Tus categorías</span>
              {customCategories.map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ flex: 1, fontSize: 14 }}>{c.label}</span>
                  <button
                    onClick={() => removeCustomCategory(c.id)}
                    style={{ ...S.btn("danger"), width: 32, height: 32, padding: 0, borderRadius: 8, flexShrink: 0 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
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
        </div>
      )}
    </div>
  );
}
