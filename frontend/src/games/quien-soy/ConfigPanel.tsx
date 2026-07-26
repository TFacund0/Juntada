import { S } from "../../theme/styles";
import { Avatar } from "../../components/Avatar";
import type { ConfigPanelProps } from "../gameTypes";
import { WordSourceConfig } from "./WordSourceConfig";

// Host-only setup shown in the multiplayer lobby: where the words come from
// (predefined categories vs. player-suggested-and-voted), plus who goes in
// what order once play starts.
export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const config = room.config as {
    wordSource?: "categories" | "suggested";
    activeCategories?: Record<string, boolean>;
    turnOrder?: string[];
  };
  const turnOrder = config.turnOrder ?? [];
  // Empty turnOrder means "shuffle it" (the engine's default) — the list
  // shown while manual mode is off is just room order, so toggling manual on
  // starts from something already on-screen instead of an empty list.
  const manual = turnOrder.length > 0;
  // Reconciled the same way the engine does at round start (resolveTurnOrder
  // in engine.ts): drop anyone who left, append anyone who joined since —
  // so a player who joins mid-setup shows up in the list instead of only
  // getting silently tacked on once the round actually starts.
  const kept = turnOrder.filter(id => room.players.some(p => p.id === id));
  const displayOrder = manual ? [...kept, ...room.players.filter(p => !kept.includes(p.id)).map(p => p.id)] : room.players.map(p => p.id);

  const move = (idx: number, dir: -1 | 1) => {
    const next = displayOrder.slice();
    const [item] = next.splice(idx, 1);
    next.splice(idx + dir, 0, item);
    updateConfig({ turnOrder: next });
  };

  return (
    <div>
      <WordSourceConfig
        wordSource={config.wordSource || "categories"}
        activeCategories={config.activeCategories || {}}
        onChange={updateConfig}
      />

      <div style={S.card}>
        <span style={S.label}>Orden de los turnos</span>
        <p style={{ ...S.muted, margin: "0 0 10px", lineHeight: 1.4 }}>Quién pregunta/adivina primero en cada ronda.</p>
        <div style={{ display: "flex", gap: 8, marginBottom: manual ? 12 : 0 }}>
          <button
            onClick={() => updateConfig({ turnOrder: [] })}
            style={{ ...S.btn(!manual ? "primary" : "ghost"), flex: 1, padding: "8px", fontSize: 13 }}
          >
            Al azar
          </button>
          <button
            onClick={() => updateConfig({ turnOrder: displayOrder })}
            style={{ ...S.btn(manual ? "primary" : "ghost"), flex: 1, padding: "8px", fontSize: 13 }}
          >
            Orden manual
          </button>
        </div>

        {manual &&
          displayOrder.map((id, idx) => {
            const p = room.players.find(pl => pl.id === id);
            if (!p) return null;
            return (
              <div
                key={id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 0",
                  borderBottom: idx < displayOrder.length - 1 ? "1px solid rgba(127,119,221,0.08)" : "none",
                }}
              >
                <span style={{ width: 18, fontSize: 12, fontWeight: 800, color: "#6b6490" }}>{idx + 1}</span>
                <Avatar name={p.name} size={28} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{p.name}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button
                    onClick={() => idx > 0 && move(idx, -1)}
                    style={{
                      ...S.btn("ghost", idx === 0),
                      width: 24,
                      height: 18,
                      padding: 0,
                      borderRadius: 6,
                      fontSize: 10,
                      lineHeight: 1,
                    }}
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => idx < displayOrder.length - 1 && move(idx, 1)}
                    style={{
                      ...S.btn("ghost", idx === displayOrder.length - 1),
                      width: 24,
                      height: 18,
                      padding: 0,
                      borderRadius: 6,
                      fontSize: 10,
                      lineHeight: 1,
                    }}
                  >
                    ▼
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
