import { MIN_PLAYERS } from "@juntada/rayado-libre-scoring";
import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { Btn } from "../../../components/ui/Btn";
import { Avatar } from "../../../components/ui/Avatar";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { SetupTabs, type SetupTab } from "../../../components/setup/SetupTabs";
import { StickyActionBar } from "../../../components/setup/StickyActionBar";
import { MinPlayersHint } from "../../../components/game-kit/MinPlayersHint";
import { StartButton } from "../../../components/setup/StartButton";
import { PhaseTransition } from "../../../components/game-kit/PhaseTransition";
import type { LocalPlayer } from "../types/localGame";
import { CategoryPicker } from "./CategoryPicker";
import { RoundsPicker } from "./RoundsPicker";
import { CustomWordsEditor } from "./CustomWordsEditor";

interface SetupScreenProps {
  players: LocalPlayer[];
  renamePlayer: (id: number, name: string) => void;
  removePlayer: (id: number) => void;
  newName: string;
  setNewName: (name: string) => void;
  addPlayer: () => void;
  nameError: string;
  nameErrorKey: number;
  setupTab: SetupTab;
  setSetupTab: (tab: SetupTab) => void;
  enabledCategories: Record<string, boolean>;
  setEnabledCategories: (next: Record<string, boolean>) => void;
  totalRounds: number;
  setTotalRounds: (n: number) => void;
  customWords: string[];
  setCustomWords: (next: string[]) => void;
  activeCatKeys: string[];
  startGame: () => void;
}

/** Pantalla de configuración local: jugadores + categorías/vueltas, antes de arrancar la partida. */
export function SetupScreen({
  players,
  renamePlayer,
  removePlayer,
  newName,
  setNewName,
  addPlayer,
  nameError,
  nameErrorKey,
  setupTab,
  setSetupTab,
  enabledCategories,
  setEnabledCategories,
  totalRounds,
  setTotalRounds,
  customWords,
  setCustomWords,
  activeCatKeys,
  startGame,
}: SetupScreenProps) {
  const canStart = players.length >= MIN_PLAYERS && (activeCatKeys.length > 0 || customWords.length > 0);
  return (
    <PhaseTransition phaseKey="setup">
      <div className="pb-[88px]">
        <SetupTabs tab={setupTab} onChange={setSetupTab} />

        {setupTab === "players" && (
          <div className={T.card}>
            <span className={T.label}>Jugadores ({players.length})</span>
            {players.map(p => (
              <div key={p.id} className="mb-2 flex items-center gap-2">
                <Avatar name={p.name} size={32} />
                <input className={clsx(T.input, "flex-1")} value={p.name} onChange={e => renamePlayer(p.id, e.target.value)} />
                <button onClick={() => removePlayer(p.id)} className={clsx(T.btn("danger"), "h-9 w-9 shrink-0 rounded-lg p-0")}>
                  ×
                </button>
              </div>
            ))}
            <div className="mt-2.5 flex gap-2">
              <input
                className={clsx(T.input, "flex-1")}
                placeholder="Nombre"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") addPlayer();
                }}
              />
              <Btn variant="ghost" onClick={addPlayer} className="w-auto px-[18px] py-[11px]">
                Agregar
              </Btn>
            </div>
            <ErrorBanner message={nameError} flashKey={nameErrorKey} variant="inline" />
          </div>
        )}

        {setupTab === "config" && (
          <>
            <div className={T.card}>
              <CategoryPicker enabled={enabledCategories} onChange={setEnabledCategories} />
            </div>

            <CustomWordsEditor words={customWords} onChange={setCustomWords} />

            <RoundsPicker value={totalRounds} onChange={setTotalRounds} />
          </>
        )}

        <StickyActionBar>
          <StartButton disabled={!canStart} onClick={startGame}>
            Empezar a jugar
          </StartButton>
          <MinPlayersHint count={players.length} min={MIN_PLAYERS} />
          {activeCatKeys.length === 0 && customWords.length === 0 && (
            <p className={clsx(T.muted, "mt-2 text-center")}>Elegí al menos una categoría o agregá tus propias palabras</p>
          )}
        </StickyActionBar>
      </div>
    </PhaseTransition>
  );
}
