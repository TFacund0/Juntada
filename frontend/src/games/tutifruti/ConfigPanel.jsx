import { useState } from "react";
import { S } from "../../theme/styles";
import { DEFAULT_CATEGORIES } from "@juntada/tutifruti-data";
import { Toggle } from "../../components/Toggle";
import { Btn } from "../../components/Btn";

// Host-only rules editor shown in the multiplayer lobby.
export function ConfigPanel({ room, updateConfig }) {
  const [tab, setTab] = useState("cats");
  const [newCat, setNewCat] = useState("");
  const customCategories = room.config.customCategories || [];

  const addCustomCategory = () => {
    const label = newCat.trim();
    if (!label) return;
    const id = `custom_${Date.now()}`;
    updateConfig({ customCategories: [...customCategories, { id, label }] });
    setNewCat("");
  };

  const removeCustomCategory = (id) => {
    updateConfig({ customCategories: customCategories.filter(c => c.id !== id) });
  };

  return (
    <div style={S.card}>
      <span style={S.label}>Configuración</span>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {["cats", "rules"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ ...S.btn(tab === t ? "primary" : "secondary"), flex: 1, padding: "8px", fontSize: 13 }}>
            {t === "cats" ? "Categorías" : "Reglas"}
          </button>
        ))}
      </div>

      {tab === "rules" && <>
        <div style={{ marginBottom: 14 }}>
          <span style={S.label}>Rondas: {room.config.rounds}</span>
          <input type="range" min="1" max="15" step="1" value={room.config.rounds} onChange={e => updateConfig({ rounds: +e.target.value })} style={{ width: "100%" }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <span style={S.label}>Cómo termina la ronda</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => updateConfig({ endMode: "timer" })} style={{ ...S.btn(room.config.endMode === "timer" ? "primary" : "secondary"), flex: 1, padding: "8px", fontSize: 13 }}>Por tiempo</button>
            <button onClick={() => updateConfig({ endMode: "basta" })} style={{ ...S.btn(room.config.endMode === "basta" ? "primary" : "secondary"), flex: 1, padding: "8px", fontSize: 13 }}>Por "¡Basta!"</button>
          </div>
        </div>
        <div>
          <span style={S.label}>
            Tiempo por ronda: {room.config.endMode === "basta" ? "No aplica" : `${room.config.roundTime}s`}
          </span>
          <input
            type="range" min="30" max="240" step="15"
            value={room.config.roundTime}
            disabled={room.config.endMode === "basta"}
            onChange={e => updateConfig({ roundTime: +e.target.value })}
            style={{ width: "100%", opacity: room.config.endMode === "basta" ? 0.4 : 1 }}
          />
        </div>
      </>}

      {tab === "cats" && <div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {DEFAULT_CATEGORIES.map(cat => (
            <Toggle key={cat.id} label={`${cat.icon} ${cat.label}`} value={!!room.config.activeCategories[cat.id]} onChange={v => updateConfig({ activeCategories: { ...room.config.activeCategories, [cat.id]: v } })} />
          ))}
        </div>
        {customCategories.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <span style={S.label}>Tus categorías</span>
            {customCategories.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ flex: 1, fontSize: 14 }}>{c.label}</span>
                <button onClick={() => removeCustomCategory(c.id)} style={{ ...S.btn("danger"), width: 32, height: 32, padding: 0, borderRadius: 8, flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input style={{ ...S.input, flex: 1 }} placeholder="Nueva categoría..." value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addCustomCategory(); }} />
          <Btn variant="secondary" onClick={addCustomCategory} style={{ width: "auto", padding: "11px 18px" }}>Agregar</Btn>
        </div>
      </div>}
    </div>
  );
}
