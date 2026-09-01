import { useState } from "react";
import clsx from "clsx";
import { T } from "../../../../theme/styles/classes";
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
import { useFlashError } from "../../../../hooks/ui/useFlashError";
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
    <div className="pb-[88px]">
      <SetupTabs tab={tab} onChange={setTab} />

      {tab === "players" && (
        <div className={T.card}>
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
          <span className={T.label}>Jugadores ({players.length})</span>
          {players.map(p => (
            <div key={p.id} className="mb-2 flex items-center gap-2">
              <Avatar name={p.name} size={32} />
              <input className={clsx(T.input, "flex-1")} value={p.name} onChange={e => renamePlayer(p.id, e.target.value)} />
              <button
                onClick={() => setPlayers(prev => prev.filter(x => x.id !== p.id))}
                className={clsx("impostor-remove-player-btn", T.btn("danger"), "h-9 w-9 shrink-0 rounded-lg p-0")}
                aria-label="Eliminar jugador"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
          <Btn variant="ghost" onClick={addPlayer} className="impostor-add-player-btn mt-2.5 border-2 border-dashed">
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
                <span className={T.label}>Impostores</span>
                <div className="flex gap-2">
                  {[1, 2, 3].map(n => {
                    const maxImp = maxImpostors(players.length);
                    return (
                      <button
                        key={n}
                        onClick={() => setConfig(c => ({ ...c, numImpostors: n }))}
                        disabled={n > maxImp}
                        className={clsx(
                          T.btn(config.numImpostors === n ? "primary" : "ghost"),
                          "flex-1 px-0 py-2.5 text-sm",
                          n > maxImp && "opacity-[0.35]",
                        )}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                {maxImpostors(players.length) < 3 && (
                  <p className={clsx(T.muted, "mt-2 leading-[1.4]")}>
                    Con {players.length} jugadores, como máximo puede haber {maxImpostors(players.length)}{" "}
                    {maxImpostors(players.length) === 1 ? "impostor" : "impostores"}.
                  </p>
                )}
              </ConfigSection>
              <ConfigSection>
                <span className={T.label}>¿El impostor recibe una pista?</span>
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={() => setConfig(c => ({ ...c, hintsEnabled: true }))}
                    className={clsx(T.btn(config.hintsEnabled ? "primary" : "ghost"), "flex-1 px-2 py-2.5 text-[13px]")}
                  >
                    Sí, con pista
                  </button>
                  <button
                    onClick={() => setConfig(c => ({ ...c, hintsEnabled: false }))}
                    className={clsx(T.btn(!config.hintsEnabled ? "primary" : "ghost"), "flex-1 px-2 py-2.5 text-[13px]")}
                  >
                    No, a ciegas
                  </button>
                </div>
                <p className={clsx(T.muted, "mt-2.5 leading-[1.4]")}>
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
                <span className={T.label}>¿Cómo dan su palabra los jugadores?</span>
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={() => setConfig(c => ({ ...c, writtenClues: true }))}
                    className={clsx(T.btn(config.writtenClues ? "primary" : "ghost"), "flex-1 px-2 py-2.5 text-[13px]")}
                  >
                    Escrita
                  </button>
                  <button
                    onClick={() => setConfig(c => ({ ...c, writtenClues: false }))}
                    className={clsx(T.btn(!config.writtenClues ? "primary" : "ghost"), "flex-1 px-2 py-2.5 text-[13px]")}
                  >
                    En voz alta
                  </button>
                </div>
                <p className={clsx(T.muted, "mt-2.5 leading-[1.4]")}>
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
                <p className={clsx(T.muted, "mt-2.5 text-xs leading-[1.4]")}>
                  No hay límite de tiempo por turno: como se van pasando el dispositivo de mano en mano, cada uno avanza cuando ya dijo su
                  palabra.
                </p>
              </ConfigSection>
              <ConfigSection>
                <span className={T.label}>
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
                  className={clsx("mt-2 w-full", config.discussionUnlimited && "opacity-40")}
                />
                <label className="mt-3 flex cursor-pointer items-center gap-2.5">
                  <div
                    className={T.toggle(config.discussionUnlimited)}
                    onClick={() => setConfig(c => ({ ...c, discussionUnlimited: !c.discussionUnlimited }))}
                  >
                    <div className={T.knob(config.discussionUnlimited)} />
                  </div>
                  <span
                    className={clsx(
                      "text-[13px] font-semibold",
                      config.discussionUnlimited ? "text-[#5DCAA5]" : "text-[var(--jt-muted-text)]",
                    )}
                  >
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
              <span className={T.label}>Orden de turno para dar la palabra</span>
              <p className={clsx(T.muted, "mt-1 mb-3 leading-[1.4]")}>
                Así van a ir pasando el dispositivo y dando su palabra en la ronda.
              </p>
              <div className="flex flex-col gap-1.5">
                {players.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2.5 py-1.5">
                    <span className="w-[18px] text-xs font-extrabold text-[var(--jt-muted-text)]">{i + 1}</span>
                    <Avatar name={p.name} size={28} />
                    <span className="flex-1 text-sm font-bold">{p.name}</span>
                    <button
                      onClick={() => movePlayer(i, -1)}
                      disabled={i === 0}
                      className={clsx(T.btn("ghost"), "h-8 w-8 rounded-lg p-0 text-sm", i === 0 && "opacity-[0.35]")}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => movePlayer(i, 1)}
                      disabled={i === players.length - 1}
                      className={clsx(T.btn("ghost"), "h-8 w-8 rounded-lg p-0 text-sm", i === players.length - 1 && "opacity-[0.35]")}
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
          <p className="mt-2 text-center text-xs text-[#E2C44A]">
            Elegí al menos una categoría en la pestaña "Categorías" para poder arrancar
          </p>
        )}
        {players.length >= 3 && activeCats.length > 0 && allCategoriesExhausted && (
          <p className="mt-2 text-center text-xs text-[#E2C44A]">
            Ya no quedan palabras sin usar en las categorías activas — activá otra en "Categorías"
          </p>
        )}
        <ErrorBanner message={wordError} flashKey={wordErrorKey} variant="inline" />
      </StickyActionBar>
    </div>
  );
}
