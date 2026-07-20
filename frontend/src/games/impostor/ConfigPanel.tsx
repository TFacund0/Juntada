import { useState } from "react";
import { S } from "../../theme/styles";
import { CATEGORIES } from "@juntada/impostor-data";
import { maxImpostors } from "@juntada/impostor-match-rules";
import { Avatar } from "../../components/Avatar";
import { TabRow } from "../../components/TabRow";
import type { ConfigPanelProps } from "../gameTypes";

// The host's configured order, filtered to players still in the room, with
// anyone missing from it (new joins, or nobody's touched it yet) appended in
// arrival order — mirrors the engine's own effectiveTurnOrder so the list
// shown here always matches what a round would actually use.
function effectiveOrder(players: { id: string }[], turnOrder: string[] | undefined): string[] {
  const ids = players.map(p => p.id);
  const stored = (turnOrder || []).filter(id => ids.includes(id));
  const missing = ids.filter(id => !stored.includes(id));
  return [...stored, ...missing];
}

// Host-only rules editor shown in the multiplayer lobby. Only re-renders when
// this game is active in the room (see games/registry.js contract). Each
// question gets its own card — cramming them all into one made the whole
// panel read as a single wall of text and buttons.

export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const [tab, setTab] = useState<"cats" | "rules" | "order">("cats");
  const config = room.config as any;
  const activeCount = Object.values(config.enabledCategories || {}).filter(Boolean).length;
  const maxImp = maxImpostors(room.players.length);
  const order = effectiveOrder(room.players, config.turnOrder);
  const orderedPlayers = order.map(id => room.players.find(p => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));

  const moveTurn = (index: number, dir: number) => {
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    updateConfig({ turnOrder: next });
  };

  return (
    <div>
      <div style={S.card}>
        <span style={S.label}>Configuración</span>
        <TabRow
          tabs={[
            { key: "cats", label: "Categorías" },
            { key: "rules", label: "Reglas" },
            { key: "order", label: "Orden" },
          ]}
          active={tab}
          onChange={setTab}
          buttonPadding="8px"
        />
      </div>

      {tab === "rules" && (
        <>
          <div style={S.card}>
            <span style={S.label}>Impostores</span>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => updateConfig({ numImpostors: n })}
                  disabled={n > maxImp}
                  style={{
                    ...S.btn(config.numImpostors === n ? "primary" : "ghost"),
                    flex: 1,
                    padding: "8px",
                    fontSize: 13,
                    opacity: n > maxImp ? 0.35 : 1,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            {maxImp < 3 && (
              <p style={{ ...S.muted, marginTop: 8, lineHeight: 1.4 }}>
                Con {room.players.length} jugadores, como máximo puede haber {maxImp}{" "}
                {maxImp === 1 ? "impostor" : "impostores"} — tienen que ser menos que los inocentes.
              </p>
            )}
          </div>

          <div style={S.card}>
            <span style={S.label}>¿Se revela el rol al eliminar a alguien?</span>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                onClick={() => updateConfig({ revealOnElimination: true })}
                style={{ ...S.btn(config.revealOnElimination ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
              >
                Sí, se revela
              </button>
              <button
                onClick={() => updateConfig({ revealOnElimination: false })}
                style={{ ...S.btn(!config.revealOnElimination ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
              >
                No, queda en duda
              </button>
            </div>
            <p style={{ ...S.muted, marginTop: 10, lineHeight: 1.4 }}>
              {config.revealOnElimination
                ? "Al eliminar a alguien se muestra si era el impostor o no."
                : "Al eliminar a alguien no se revela su rol — sigan jugando con la duda."}
            </p>
          </div>

          <div style={S.card}>
            <span style={S.label}>¿El impostor recibe una pista?</span>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                onClick={() => updateConfig({ hintsEnabled: true })}
                style={{ ...S.btn(config.hintsEnabled ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
              >
                Sí, con pista
              </button>
              <button
                onClick={() => updateConfig({ hintsEnabled: false })}
                style={{ ...S.btn(!config.hintsEnabled ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
              >
                No, a ciegas
              </button>
            </div>
            <p style={{ ...S.muted, marginTop: 10, lineHeight: 1.4 }}>
              {config.hintsEnabled
                ? "El impostor ve una pista relacionada con la palabra secreta, para poder disimular."
                : "El impostor no sabe nada de la palabra secreta — tiene que improvisar."}
            </p>
          </div>

          <div style={S.card}>
            <span style={S.label}>¿Cómo dan su palabra los jugadores?</span>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                onClick={() => updateConfig({ writtenClues: true })}
                style={{ ...S.btn(config.writtenClues ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
              >
                Escrita
              </button>
              <button
                onClick={() => updateConfig({ writtenClues: false })}
                style={{ ...S.btn(!config.writtenClues ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
              >
                En voz alta
              </button>
            </div>
            <p style={{ ...S.muted, marginTop: 10, lineHeight: 1.4 }}>
              {config.writtenClues
                ? "Cada uno escribe su palabra en el dispositivo por turnos, y queda visible para todos apenas la envía."
                : "Cada uno dice su palabra en voz alta, por turnos, y solo confirma en el dispositivo cuando ya la dijo."}
            </p>
          </div>

          <div style={S.card}>
            <span style={S.label}>Tiempo por turno: {config.clueTime === 0 ? "Sin límite" : `${config.clueTime}s`}</span>
            <p style={{ ...S.muted, margin: "4px 0 0", lineHeight: 1.4 }}>Cuánto tiene cada jugador para dar su palabra cuando le toca.</p>
            <input
              type="range"
              min="0"
              max="180"
              step="15"
              value={config.clueTime}
              onChange={e => updateConfig({ clueTime: +e.target.value })}
              style={{ width: "100%", marginTop: 8 }}
            />
          </div>

          <div style={S.card}>
            <span style={S.label}>
              Tiempo de discusión:{" "}
              {config.discussionUnlimited ? "Sin límite" : config.discussionTime === 0 ? "Sin fase de discusión" : `${config.discussionTime}s`}
            </span>
            <p style={{ ...S.muted, margin: "4px 0 8px", lineHeight: 1.4 }}>Cuánto dura la charla antes de pasar a la votación.</p>
            <input
              type="range"
              min="0"
              max="180"
              step="15"
              value={config.discussionTime}
              disabled={config.discussionUnlimited}
              onChange={e => updateConfig({ discussionTime: +e.target.value, discussionUnlimited: false })}
              style={{ width: "100%", opacity: config.discussionUnlimited ? 0.4 : 1 }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, cursor: "pointer" }}>
              <div style={S.toggle(!!config.discussionUnlimited)} onClick={() => updateConfig({ discussionUnlimited: !config.discussionUnlimited })}>
                <div style={S.knob(!!config.discussionUnlimited)} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: config.discussionUnlimited ? "#5DCAA5" : "#6b6490" }}>
                Discusión sin límite de tiempo — pasan a votar cuando estén todos listos
              </span>
            </label>
          </div>
        </>
      )}

      {tab === "cats" && (
        <div style={S.card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={S.label}>Categorías</span>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() =>
                  updateConfig({
                    enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: true }), {}),
                  })
                }
                style={{ background: "none", border: "none", color: "#7F77DD", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}
              >
                Todas
              </button>
              <button
                onClick={() =>
                  updateConfig({
                    enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: false }), {}),
                  })
                }
                style={{ background: "none", border: "none", color: "#7F77DD", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}
              >
                Ninguna
              </button>
            </div>
          </div>
          <p style={{ ...S.muted, margin: "4px 0 14px", lineHeight: 1.4 }}>
            Elegí de qué van a ser las palabras. Tocá una categoría para activarla.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {Object.entries(CATEGORIES).map(([k, cat]: [string, any]) => {
              const active = !!config.enabledCategories?.[k];
              return (
                <button
                  key={k}
                  onClick={() => updateConfig({ enabledCategories: { ...config.enabledCategories, [k]: !active } })}
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
          <p style={{ ...S.muted, marginTop: 14 }}>
            {activeCount === 0 ? "No elegiste ninguna categoría todavía." : `${activeCount} categoría${activeCount === 1 ? "" : "s"} activa${activeCount === 1 ? "" : "s"}.`}
          </p>
        </div>
      )}

      {tab === "order" && (
        <div style={S.card}>
          <span style={S.label}>Orden de turno para dar la palabra</span>
          <p style={{ ...S.muted, margin: "4px 0 12px", lineHeight: 1.4 }}>
            Así van a ir pasando su palabra en la ronda. Los que se sumen después entran al final.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {orderedPlayers.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                <span style={{ width: 18, fontSize: 12, fontWeight: 800, color: "#6b6490" }}>{i + 1}</span>
                <Avatar name={p.name} size={28} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{p.name}</span>
                <button
                  onClick={() => moveTurn(i, -1)}
                  disabled={i === 0}
                  style={{ ...S.btn("ghost"), width: 44, height: 44, padding: 0, borderRadius: 10, fontSize: 18, opacity: i === 0 ? 0.35 : 1 }}
                >
                  ↑
                </button>
                <button
                  onClick={() => moveTurn(i, 1)}
                  disabled={i === orderedPlayers.length - 1}
                  style={{
                    ...S.btn("ghost"),
                    width: 44,
                    height: 44,
                    padding: 0,
                    borderRadius: 10,
                    fontSize: 18,
                    opacity: i === orderedPlayers.length - 1 ? 0.35 : 1,
                  }}
                >
                  ↓
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
