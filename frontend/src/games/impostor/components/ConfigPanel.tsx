import { useEffect, useState } from "react";
import { S } from "../../../theme/styles";
import { maxImpostors } from "@juntada/impostor-match-rules";
import { TurnOrderEditor } from "../../../components/TurnOrderEditor";
import { ConfigSection } from "./ConfigSection";
import { ConfigTabs } from "./ConfigTabs";
import { CategoriesTab } from "./CategoriesTab";
import { RevealOnEliminationControl } from "./RevealOnEliminationControl";
import { ShowCategoryControl } from "./ShowCategoryControl";
import type { ConfigPanelProps } from "../../gameTypes";

// Host-only rules editor shown in the multiplayer lobby. Only re-renders when
// this game is active in the room (see games/registry.js contract). Every
// rule question lives inside one shared card, separated by ConfigSection
// dividers (shared with LocalGame's own "Reglas" tab).

export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const [tab, setTab] = useState<"cats" | "rules" | "order">("cats");
  const config = room.config as any;
  const maxImp = maxImpostors(room.players.length);
  const usedWords = room.usedWords as Record<string, string[]>;

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
            <RevealOnEliminationControl
              value={!!config.revealOnElimination}
              onChange={revealOnElimination => updateConfig({ revealOnElimination })}
            />
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
            <ShowCategoryControl value={!!config.showCategory} onChange={showCategory => updateConfig({ showCategory })} />
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
              <span style={{ fontSize: 13, fontWeight: 600, color: config.discussionUnlimited ? "#5DCAA5" : "var(--jt-muted-text)" }}>
                Discusión sin límite de tiempo — pasan a votar cuando estén todos listos
              </span>
            </label>
          </ConfigSection>
        </div>
      )}

      {tab === "cats" && (
        <CategoriesTab
          enabledCategories={config.enabledCategories || {}}
          usedWords={usedWords}
          onChange={enabledCategories => updateConfig({ enabledCategories })}
        />
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
