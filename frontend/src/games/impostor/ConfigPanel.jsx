import { useState } from "react";
import { S } from "../../theme/styles";
import { CATEGORIES } from "@juntada/impostor-data";
import { Toggle } from "../../components/Toggle";

// Host-only rules editor shown in the multiplayer lobby. Only re-renders when
// this game is active in the room (see games/registry.js contract).
export function ConfigPanel({ room, updateConfig }) {
  const [tab, setTab] = useState("cats");

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
          <span style={S.label}>Impostores</span>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3].map(n => (
              <button key={n} onClick={() => updateConfig({ numImpostors: n })} style={{ ...S.btn(room.config.numImpostors === n ? "primary" : "secondary"), flex: 1, padding: "8px", fontSize: 13 }}>{n}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <Toggle label={room.config.hintsEnabled ? "Pistas al impostor" : "Sin pistas"} value={room.config.hintsEnabled} onChange={v => updateConfig({ hintsEnabled: v })} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <Toggle label={room.config.writtenClues ? "Pistas escritas (se ven al votar)" : "Pistas dichas en voz alta"} value={room.config.writtenClues} onChange={v => updateConfig({ writtenClues: v })} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <span style={S.label}>Tiempo de pistas: {room.config.clueTime === 0 ? "Sin límite" : `${room.config.clueTime}s`}</span>
          <input type="range" min="0" max="180" step="15" value={room.config.clueTime} onChange={e => updateConfig({ clueTime: +e.target.value })} style={{ width: "100%" }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <Toggle label={room.config.discussionUnlimited ? "Discusión sin límite de tiempo" : "Discusión con tiempo limitado"} value={room.config.discussionUnlimited} onChange={v => updateConfig({ discussionUnlimited: v })} />
        </div>
        <div>
          <span style={S.label}>
            Tiempo de discusión: {room.config.discussionUnlimited ? "Sin límite" : room.config.discussionTime === 0 ? "Sin fase de discusión" : `${room.config.discussionTime}s`}
          </span>
          <input
            type="range" min="0" max="180" step="15"
            value={room.config.discussionTime}
            disabled={room.config.discussionUnlimited}
            onChange={e => updateConfig({ discussionTime: +e.target.value })}
            style={{ width: "100%", opacity: room.config.discussionUnlimited ? 0.4 : 1 }}
          />
        </div>
      </>}

      {tab === "cats" && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Object.entries(CATEGORIES).map(([k, cat]) => (
          <Toggle key={k} label={`${cat.icon} ${cat.label}`} value={room.config.enabledCategories[k]} onChange={v => updateConfig({ enabledCategories: { ...room.config.enabledCategories, [k]: v } })} />
        ))}
      </div>}
    </div>
  );
}
