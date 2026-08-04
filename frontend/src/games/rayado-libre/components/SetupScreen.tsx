import { MIN_PLAYERS } from "@juntada/rayado-libre-scoring";
import { S } from "../../../theme/styles";
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
      <div style={{ paddingBottom: 88 }}>
        <SetupTabs tab={setupTab} onChange={setSetupTab} />

        {setupTab === "players" && (
          <div style={S.card}>
            <span style={S.label}>Jugadores ({players.length})</span>
            {players.map(p => (
              <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <Avatar name={p.name} size={32} />
                <input style={{ ...S.input, flex: 1 }} value={p.name} onChange={e => renamePlayer(p.id, e.target.value)} />
                <button
                  onClick={() => removePlayer(p.id)}
                  style={{ ...S.btn("danger"), width: 36, height: 36, padding: 0, borderRadius: 8, flexShrink: 0 }}
                >
                  ×
                </button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input
                style={{ ...S.input, flex: 1 }}
                placeholder="Nombre"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") addPlayer();
                }}
              />
              <Btn variant="ghost" onClick={addPlayer} style={{ width: "auto", padding: "11px 18px" }}>
                Agregar
              </Btn>
            </div>
            <ErrorBanner message={nameError} flashKey={nameErrorKey} variant="inline" />
          </div>
        )}

        {setupTab === "config" && (
          <>
            <div style={S.card}>
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
            <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>Elegí al menos una categoría o agregá tus propias palabras</p>
          )}
        </StickyActionBar>
      </div>
    </PhaseTransition>
  );
}
