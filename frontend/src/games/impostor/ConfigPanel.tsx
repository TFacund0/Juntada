import { useState } from "react";
import { S } from "../../theme/styles";
import { CATEGORIES } from "@juntada/impostor-data";
import { Toggle } from "../../components/Toggle";
import type { ConfigPanelProps } from "../gameTypes";

// Host-only rules editor shown in the multiplayer lobby. Only re-renders when
// this game is active in the room (see games/registry.js contract).
export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const [tab, setTab] = useState<"cats" | "rules">("cats");
  const config = room.config as any;

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
            <span style={S.label}>Impostores</span>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => updateConfig({ numImpostors: n })}
                  style={{ ...S.btn(config.numImpostors === n ? "primary" : "ghost"), flex: 1, padding: "8px", fontSize: 13 }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <Toggle
              label={config.hintsEnabled ? "Pistas al impostor" : "Sin pistas"}
              value={config.hintsEnabled}
              onChange={v => updateConfig({ hintsEnabled: v })}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <Toggle
              label={config.writtenClues ? "Pistas escritas (se ven al votar)" : "Pistas dichas en voz alta"}
              value={config.writtenClues}
              onChange={v => updateConfig({ writtenClues: v })}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={S.label}>Tiempo de pistas: {config.clueTime === 0 ? "Sin límite" : `${config.clueTime}s`}</span>
            <input
              type="range"
              min="0"
              max="180"
              step="15"
              value={config.clueTime}
              onChange={e => updateConfig({ clueTime: +e.target.value })}
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <Toggle
              label={config.discussionUnlimited ? "Discusión sin límite de tiempo" : "Discusión con tiempo limitado"}
              value={config.discussionUnlimited}
              onChange={v => updateConfig({ discussionUnlimited: v })}
            />
          </div>
          <div>
            <span style={S.label}>
              Tiempo de discusión:{" "}
              {config.discussionUnlimited
                ? "Sin límite"
                : config.discussionTime === 0
                  ? "Sin fase de discusión"
                  : `${config.discussionTime}s`}
            </span>
            <input
              type="range"
              min="0"
              max="180"
              step="15"
              value={config.discussionTime}
              disabled={config.discussionUnlimited}
              onChange={e => updateConfig({ discussionTime: +e.target.value })}
              style={{ width: "100%", opacity: config.discussionUnlimited ? 0.4 : 1 }}
            />
          </div>
        </>
      )}

      {tab === "cats" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Object.entries(CATEGORIES).map(([k, cat]: [string, any]) => (
            <Toggle
              key={k}
              label={`${cat.icon} ${cat.label}`}
              value={config.enabledCategories[k]}
              onChange={v => updateConfig({ enabledCategories: { ...config.enabledCategories, [k]: v } })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
