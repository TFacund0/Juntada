import { useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import type { ConfigPanelProps } from "../gameTypes";

interface Entry {
  id: string;
  name: string;
  description: string;
}

// Host-only, se muestra en el lobby: carga las entradas de la ruleta (nombre
// + descripción opcional) y elige el modo. Todo se guarda en room.config y
// se sincroniza para que LobbyInfo lo espeje a los demás jugadores.
export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const config = room.config as { entries?: Entry[]; mode?: "keep" | "eliminate" };
  const entries = config.entries || [];
  const mode = config.mode || "eliminate";
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const addEntry = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateConfig({ entries: [...entries, { id: `${Date.now()}-${Math.random()}`, name: trimmed, description: desc.trim() }] });
    setName("");
    setDesc("");
  };

  const removeEntry = (id: string) => updateConfig({ entries: entries.filter(e => e.id !== id) });

  return (
    <div>
      <div style={S.card}>
        <span style={S.label}>Entradas ({entries.length})</span>
        {entries.map(e => (
          <div key={e.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{e.name}</p>
              {e.description && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9089c0" }}>{e.description}</p>}
            </div>
            <button
              onClick={() => removeEntry(e.id)}
              style={{ ...S.btn("danger"), width: 32, height: 32, padding: 0, borderRadius: 8, flexShrink: 0 }}
            >
              ×
            </button>
          </div>
        ))}

        <input
          style={{ ...S.input, marginBottom: 8 }}
          placeholder="Nombre (ej: Juan, o 'Prenda 1')"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) addEntry();
          }}
        />
        <textarea
          style={{ ...S.input, marginBottom: 8, resize: "vertical", minHeight: 60 }}
          placeholder="Descripción / castigo (opcional)"
          value={desc}
          onChange={e => setDesc(e.target.value)}
        />
        <Btn variant="ghost" onClick={addEntry}>
          Agregar a la ruleta
        </Btn>
        {entries.length < 2 && <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>Cargá al menos 2 entradas</p>}
      </div>

      <div style={S.card}>
        <span style={S.label}>Modo</span>
        <label
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 10 }}
          onClick={() => updateConfig({ mode: "keep" })}
        >
          <input type="radio" readOnly checked={mode === "keep"} />
          <span style={{ fontSize: 13 }}>Repetir — se mantienen todas las entradas, se puede girar las veces que quieran</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => updateConfig({ mode: "eliminate" })}>
          <input type="radio" readOnly checked={mode === "eliminate"} />
          <span style={{ fontSize: 13 }}>Eliminación — la que sale se saca de la ruleta</span>
        </label>
      </div>
    </div>
  );
}
