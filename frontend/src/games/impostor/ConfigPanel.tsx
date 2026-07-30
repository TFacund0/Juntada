import { useEffect, useState } from "react";
import { S } from "../../theme/styles";
import { CATEGORIES } from "@juntada/impostor-data";
import { maxImpostors } from "@juntada/impostor-match-rules";
import { TurnOrderEditor } from "../../components/TurnOrderEditor";
import { ConfigSection } from "./components/ConfigSection";
import { ConfigTabs } from "./components/ConfigTabs";
import { Toggle } from "../../components/Toggle";
import type { ConfigPanelProps } from "../gameTypes";

// Host-only rules editor shown in the multiplayer lobby. Only re-renders when
// this game is active in the room (see games/registry.js contract). Every
// rule question lives inside one shared card, separated by ConfigSection
// dividers (shared with LocalGame's own "Reglas" tab).

export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const [tab, setTab] = useState<"cats" | "rules" | "order">("cats");
  const config = room.config as any;
  const activeCount = Object.values(config.enabledCategories || {}).filter(Boolean).length;
  const maxImp = maxImpostors(room.players.length);
  const usedWords = room.usedWords as Record<string, string[]>;
  const wordsLeftIn = (catKey: string) => CATEGORIES[catKey].words.length - (usedWords[catKey] || []).length;
  const activeCats = Object.keys(config.enabledCategories || {}).filter(k => config.enabledCategories[k]);
  const allCategoriesExhausted = activeCats.length > 0 && activeCats.every(k => wordsLeftIn(k) <= 0);

  // Mirrors LocalGame's own clamp effect (see LocalGame.tsx) — without it,
  // a host who picks e.g. 2 impostors and then loses players keeps seeing
  // "2" selected here even though startRound would silently clamp it lower.
  useEffect(() => {
    const cap = maxImpostors(room.players.length);
    if (config.numImpostors > cap) updateConfig({ numImpostors: cap });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.players.length]);

  return (
    <div>
      <ConfigTabs active={tab} onChange={setTab} />

      {tab === "rules" && (
        <div style={S.card}>
          <ConfigSection divider={false}>
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
                Con {room.players.length} jugadores, como máximo puede haber {maxImp} {maxImp === 1 ? "impostor" : "impostores"} — tienen
                que ser menos que los inocentes.
              </p>
            )}
          </ConfigSection>

          <ConfigSection>
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
          </ConfigSection>

          <ConfigSection>
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
          </ConfigSection>

          <ConfigSection>
            <Toggle
              label="Mostrar la categoría junto a la palabra"
              value={!!config.showCategory}
              onChange={showCategory => updateConfig({ showCategory })}
            />
            <p style={{ ...S.muted, marginTop: 10, lineHeight: 1.4 }}>
              {config.showCategory
                ? "Todos ven de qué categoría es la palabra al revelar su carta — inocentes e impostor por igual."
                : "Nadie ve la categoría, solo la palabra (o la pista, si el impostor tiene una activada)."}
            </p>
          </ConfigSection>

          <ConfigSection>
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
          </ConfigSection>

          <ConfigSection>
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
          </ConfigSection>

          <ConfigSection>
            <span style={S.label}>
              Tiempo de discusión:{" "}
              {config.discussionUnlimited
                ? "Sin límite"
                : config.discussionTime === 0
                  ? "Sin fase de discusión"
                  : `${config.discussionTime}s`}
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
              <div
                style={S.toggle(!!config.discussionUnlimited)}
                onClick={() => updateConfig({ discussionUnlimited: !config.discussionUnlimited })}
              >
                <div style={S.knob(!!config.discussionUnlimited)} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: config.discussionUnlimited ? "#5DCAA5" : "#6b6490" }}>
                Discusión sin límite de tiempo — pasan a votar cuando estén todos listos
              </span>
            </label>
          </ConfigSection>
        </div>
      )}

      {tab === "cats" && (
        <div style={S.card}>
          <span style={S.label}>Categorías</span>
          <p style={{ ...S.muted, margin: "4px 0 12px", lineHeight: 1.4 }}>
            Elegí de qué van a ser las palabras. Tocá una categoría para activarla.
          </p>
          <style>{`
            .impostor-cats-bulk-btn {
              transition: transform 0.1s ease-out, filter 0.15s ease-out, box-shadow 0.15s ease-out;
            }
            .impostor-cats-bulk-btn:hover {
              transform: translateY(-1px);
              filter: brightness(1.25);
            }
            .impostor-cats-bulk-btn:active {
              transform: scale(0.96);
            }
          `}</style>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button
              className="impostor-cats-bulk-btn"
              onClick={() =>
                updateConfig({
                  enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: true }), {}),
                })
              }
              style={{
                flex: 1,
                background: "rgba(127,119,221,0.12)",
                border: "1px solid rgba(127,119,221,0.4)",
                borderRadius: 8,
                color: "#AFA9EC",
                cursor: "pointer",
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "inherit",
              }}
            >
              ✓ Seleccionar todas
            </button>
            <button
              className="impostor-cats-bulk-btn"
              onClick={() =>
                updateConfig({
                  enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: false }), {}),
                })
              }
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 8,
                color: "#9089c0",
                cursor: "pointer",
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "inherit",
              }}
            >
              ✕ Quitar todas
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {Object.entries(CATEGORIES).map(([k, cat]: [string, any]) => {
              const active = !!config.enabledCategories?.[k];
              const remaining = wordsLeftIn(k);
              const exhausted = remaining <= 0;
              return (
                <button
                  key={k}
                  onClick={() => updateConfig({ enabledCategories: { ...config.enabledCategories, [k]: !active } })}
                  title={exhausted ? "Ya se usaron todas las palabras de esta categoría en esta partida" : undefined}
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
                    opacity: exhausted ? 0.55 : 1,
                  }}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span style={{ fontSize: 11, opacity: 0.75 }}>{exhausted ? "· sin palabras" : `· ${remaining}`}</span>
                </button>
              );
            })}
          </div>
          <p style={{ ...S.muted, marginTop: 14 }}>
            {activeCount === 0
              ? "No elegiste ninguna categoría todavía."
              : `${activeCount} categoría${activeCount === 1 ? "" : "s"} activa${activeCount === 1 ? "" : "s"}.`}
          </p>
          {allCategoriesExhausted && (
            <p style={{ fontSize: 12, color: "#F09595", marginTop: 4 }}>
              Ya se usaron todas las palabras de las categorías activas — activá otra para poder seguir jugando.
            </p>
          )}
        </div>
      )}

      {tab === "order" && (
        <TurnOrderEditor
          players={room.players}
          turnOrder={config.turnOrder}
          onChange={turnOrder => updateConfig({ turnOrder })}
          label="Orden de turno para dar la palabra"
          helpText="Así van a ir pasando su palabra en la ronda. Los que se sumen después entran al final."
        />
      )}
    </div>
  );
}
