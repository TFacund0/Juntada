import { useState } from "react";
import { S } from "../../../../theme/styles";
import { CATEGORIES } from "@juntada/impostor-data";
import { maxImpostors } from "@juntada/impostor-match-rules";
import { nextPlayerName } from "../../../../utils/nextPlayerName";
import { Btn } from "../../../../components/ui/Btn";
import { Avatar } from "../../../../components/ui/Avatar";
import { SetupTabs, type SetupTab } from "../../../../components/setup/SetupTabs";
import { StickyActionBar } from "../../../../components/setup/StickyActionBar";
import { StartButton } from "../../../../components/setup/StartButton";
import { MinPlayersHint } from "../../../../components/game-kit/MinPlayersHint";
import { ErrorBanner } from "../../../../components/ui/ErrorBanner";
import { useFlashError } from "../../../../hooks/useFlashError";
import { ConfigSection } from "../config/ConfigSection";
import { ConfigTabs } from "../config/ConfigTabs";
import { CategoriesTab } from "../config/CategoriesTab";
import { RevealOnEliminationControl } from "../config/RevealOnEliminationControl";
import { ShowCategoryControl } from "../config/ShowCategoryControl";
import type { LocalPlayer, Config } from "../../types/localGame";

interface SetupScreenProps {
  players: LocalPlayer[];
  setPlayers: (updater: (prev: LocalPlayer[]) => LocalPlayer[]) => void;
  config: Config;
  setConfig: (updater: (prev: Config) => Config) => void;
  usedWords: Record<string, string[]>;
  startRound: () => void;
  wordError: string;
  wordErrorKey: number;
}

// The setup phase: players roster, config (rules/categories/turn order), and
// the "Iniciar ronda" sticky bar. Everything here is local-only concern —
// nothing outside this phase needs the player-name input, tab state, etc.
export function SetupScreen({ players, setPlayers, config, setConfig, usedWords, startRound, wordError, wordErrorKey }: SetupScreenProps) {
  const [nameError, nameErrorKey, setNameError] = useFlashError();
  const [tab, setTab] = useState<SetupTab>("players");
  // Mirrors online's ConfigPanel.tsx sub-tabs so both modes organize the
  // rules the same way.
  const [configTab, setConfigTab] = useState<"cats" | "rules" | "order">("cats");

  const activeCats = Object.keys(config.enabledCategories).filter(k => config.enabledCategories[k]);
  const wordsLeftIn = (catKey: string) => CATEGORIES[catKey].words.length - (usedWords[catKey] || []).length;
  const allCategoriesExhausted = activeCats.length > 0 && activeCats.every(k => wordsLeftIn(k) <= 0);

  const isDuplicateName = (name: string, excludeId: number | null) => {
    const norm = name.trim().toLowerCase();
    return players.some(p => p.id !== excludeId && p.name.trim().toLowerCase() === norm);
  };

  // The players array's own order doubles as the turn order (see LocalGame's
  // reveal phase, which just walks it in sequence) — same idea as online's
  // ConfigPanel "Orden" tab, just reordering the roster directly instead of
  // a separate turnOrder field since there's no separate join order to
  // preserve here.
  const movePlayer = (index: number, dir: number) => {
    const target = index + dir;
    if (target < 0 || target >= players.length) return;
    setPlayers(prev => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const renamePlayer = (id: number, name: string) => {
    if (name.trim() && isDuplicateName(name, id)) {
      setNameError("Ya hay un jugador con ese nombre");
      return;
    }
    setNameError("");
    setPlayers(prev => prev.map(x => (x.id === id ? { ...x, name } : x)));
  };

  const addPlayer = () => {
    const trimmed = nextPlayerName(players.map(p => p.name));
    setNameError("");
    setPlayers(p => [...p, { id: Date.now(), name: trimmed }]);
  };

  return (
    <div style={{ paddingBottom: 88 }}>
      <SetupTabs tab={tab} onChange={setTab} />

      {tab === "players" && (
        <div style={S.card}>
          <style>{`
            .impostor-add-player-btn {
              transition: transform 0.1s ease-out, filter 0.15s ease-out, box-shadow 0.15s ease-out, border-color 0.2s ease-out;
            }
            .impostor-add-player-btn:hover {
              transform: translateY(-1px);
              filter: brightness(1.25);
              border-color: var(--jt-accent, #7F77DD);
            }
            .impostor-add-player-btn:active {
              transform: scale(0.97);
            }
            .impostor-remove-player-btn {
              display: flex;
              align-items: center;
              justify-content: center;
            }
          `}</style>
          <span style={S.label}>Jugadores ({players.length})</span>
          {players.map(p => (
            <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <Avatar name={p.name} size={32} />
              <input style={{ ...S.input, flex: 1 }} value={p.name} onChange={e => renamePlayer(p.id, e.target.value)} />
              <button
                onClick={() => setPlayers(prev => prev.filter(x => x.id !== p.id))}
                className="impostor-remove-player-btn"
                aria-label="Eliminar jugador"
                style={{ ...S.btn("danger"), width: 36, height: 36, padding: 0, borderRadius: 8, flexShrink: 0 }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
          <Btn
            variant="ghost"
            onClick={addPlayer}
            className="impostor-add-player-btn"
            style={{ marginTop: 10, borderStyle: "dashed", borderWidth: 2 }}
          >
            + Añadir jugador
          </Btn>
          <ErrorBanner message={nameError} flashKey={nameErrorKey} variant="inline" />
        </div>
      )}

      {tab === "config" && (
        <ConfigTabs active={configTab} onChange={setConfigTab}>
          {configTab === "rules" && (
            <div>
              <ConfigSection divider={false}>
                <span style={S.label}>Impostores</span>
                <div style={{ display: "flex", gap: 8 }}>
                  {[1, 2, 3].map(n => {
                    const maxImp = maxImpostors(players.length);
                    return (
                      <button
                        key={n}
                        onClick={() => setConfig(c => ({ ...c, numImpostors: n }))}
                        disabled={n > maxImp}
                        style={{
                          ...S.btn(config.numImpostors === n ? "primary" : "ghost"),
                          flex: 1,
                          padding: "10px 0",
                          fontSize: 14,
                          opacity: n > maxImp ? 0.35 : 1,
                        }}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                {maxImpostors(players.length) < 3 && (
                  <p style={{ ...S.muted, marginTop: 8, lineHeight: 1.4 }}>
                    Con {players.length} jugadores, como máximo puede haber {maxImpostors(players.length)}{" "}
                    {maxImpostors(players.length) === 1 ? "impostor" : "impostores"}.
                  </p>
                )}
              </ConfigSection>
              <ConfigSection>
                <span style={S.label}>¿El impostor recibe una pista?</span>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => setConfig(c => ({ ...c, hintsEnabled: true }))}
                    style={{ ...S.btn(config.hintsEnabled ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
                  >
                    Sí, con pista
                  </button>
                  <button
                    onClick={() => setConfig(c => ({ ...c, hintsEnabled: false }))}
                    style={{ ...S.btn(!config.hintsEnabled ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
                  >
                    No, a ciegas
                  </button>
                </div>
                <p style={{ ...S.muted, marginTop: 10, lineHeight: 1.4 }}>
                  {config.hintsEnabled
                    ? "El impostor ve una pista sutil sobre la palabra, para poder disimular."
                    : "El impostor no sabe nada de la palabra secreta — tiene que improvisar."}
                </p>
              </ConfigSection>
              <ConfigSection>
                <RevealOnEliminationControl
                  value={config.revealOnElimination}
                  onChange={revealOnElimination => setConfig(c => ({ ...c, revealOnElimination }))}
                />
              </ConfigSection>
              <ConfigSection>
                <ShowCategoryControl value={config.showCategory} onChange={showCategory => setConfig(c => ({ ...c, showCategory }))} />
              </ConfigSection>
              <ConfigSection>
                <span style={S.label}>¿Cómo dan su palabra los jugadores?</span>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => setConfig(c => ({ ...c, writtenClues: true }))}
                    style={{ ...S.btn(config.writtenClues ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
                  >
                    Escrita
                  </button>
                  <button
                    onClick={() => setConfig(c => ({ ...c, writtenClues: false }))}
                    style={{ ...S.btn(!config.writtenClues ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
                  >
                    En voz alta
                  </button>
                </div>
                <p style={{ ...S.muted, marginTop: 10, lineHeight: 1.4 }}>
                  {config.writtenClues
                    ? "Cada uno escribe su palabra en el dispositivo antes de pasarlo, y quedan visibles para repasar antes de votar."
                    : "Cada uno dice su palabra en voz alta, por turnos, sin escribir nada."}
                </p>
                {/* Online tiene un "tiempo por turno" además de este porque cada
                jugador tiene su propio dispositivo y hay que evitar que uno
                se cuelgue mientras el resto espera. Acá el dispositivo se va
                pasando de mano en mano, así que ya queda en manos del grupo
                cuánto tarda cada uno antes de tocar "Siguiente jugador" —
                no hace falta un cronómetro server-side para eso. */}
                <p style={{ ...S.muted, marginTop: 10, lineHeight: 1.4, fontSize: 12 }}>
                  No hay límite de tiempo por turno: como se van pasando el dispositivo de mano en mano, cada uno avanza cuando ya dijo su
                  palabra.
                </p>
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
                <input
                  type="range"
                  min="0"
                  max="180"
                  step="15"
                  value={config.discussionTime}
                  disabled={config.discussionUnlimited}
                  onChange={e => setConfig(c => ({ ...c, discussionTime: +e.target.value, discussionUnlimited: false }))}
                  style={{ width: "100%", marginTop: 8, opacity: config.discussionUnlimited ? 0.4 : 1 }}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, cursor: "pointer" }}>
                  <div
                    style={S.toggle(config.discussionUnlimited)}
                    onClick={() => setConfig(c => ({ ...c, discussionUnlimited: !c.discussionUnlimited }))}
                  >
                    <div style={S.knob(config.discussionUnlimited)} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: config.discussionUnlimited ? "#5DCAA5" : "var(--jt-muted-text)" }}>
                    Discusión sin límite de tiempo — pasan a votar cuando estén todos listos
                  </span>
                </label>
              </ConfigSection>
            </div>
          )}

          {configTab === "cats" && (
            <CategoriesTab
              enabledCategories={config.enabledCategories}
              usedWords={usedWords}
              onChange={enabledCategories => setConfig(c => ({ ...c, enabledCategories }))}
            />
          )}

          {configTab === "order" && (
            <div>
              <span style={S.label}>Orden de turno para dar la palabra</span>
              <p style={{ ...S.muted, margin: "4px 0 12px", lineHeight: 1.4 }}>
                Así van a ir pasando el dispositivo y dando su palabra en la ronda.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {players.map((p, i) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                    <span style={{ width: 18, fontSize: 12, fontWeight: 800, color: "var(--jt-muted-text)" }}>{i + 1}</span>
                    <Avatar name={p.name} size={28} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{p.name}</span>
                    <button
                      onClick={() => movePlayer(i, -1)}
                      disabled={i === 0}
                      style={{
                        ...S.btn("ghost"),
                        width: 32,
                        height: 32,
                        padding: 0,
                        borderRadius: 8,
                        fontSize: 14,
                        opacity: i === 0 ? 0.35 : 1,
                      }}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => movePlayer(i, 1)}
                      disabled={i === players.length - 1}
                      style={{
                        ...S.btn("ghost"),
                        width: 32,
                        height: 32,
                        padding: 0,
                        borderRadius: 8,
                        fontSize: 14,
                        opacity: i === players.length - 1 ? 0.35 : 1,
                      }}
                    >
                      ↓
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ConfigTabs>
      )}

      <StickyActionBar>
        <StartButton onClick={startRound} disabled={players.length < 3 || activeCats.length === 0 || allCategoriesExhausted}>
          Empezar partida
        </StartButton>
        <MinPlayersHint count={players.length} min={3} />
        {players.length >= 3 && activeCats.length === 0 && (
          <p style={{ fontSize: 12, color: "#E2C44A", textAlign: "center", marginTop: 8 }}>
            Elegí al menos una categoría en la pestaña "Categorías" para poder arrancar
          </p>
        )}
        {players.length >= 3 && activeCats.length > 0 && allCategoriesExhausted && (
          <p style={{ fontSize: 12, color: "#E2C44A", textAlign: "center", marginTop: 8 }}>
            Ya no quedan palabras sin usar en las categorías activas — activá otra en "Categorías"
          </p>
        )}
        <ErrorBanner message={wordError} flashKey={wordErrorKey} variant="inline" />
      </StickyActionBar>
    </div>
  );
}
