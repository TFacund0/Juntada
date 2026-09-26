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

// Mismo ancho y cortes que el lobby online (LOBBY_BREAKOUT/LOBBY_GRID en
// features/multiplayer/screens/LobbyScreen.tsx): hasta 1100px y, desde
// 900px, jugadores | configuración lado a lado sin pestañas. Rayado usa
// `wideRoundView: "full"` (1440px, para la pantalla de dibujo), así que el
// tope lo pone esta pantalla y no el shell.
const SETUP_WRAP = "mx-auto mt-2 w-full max-w-[1100px] pb-[88px] min-[900px]:mt-5";
const SETUP_GRID = "min-[900px]:grid min-[900px]:grid-cols-2 min-[900px]:items-start min-[900px]:gap-7";

/** En celular se ve solo la pestaña activa; desde 900px, las dos columnas siempre. */
const panelClass = (active: boolean) => (active ? "block" : "hidden min-[900px]:block");

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
  // La entrada de la pantalla la pone ScreenSwap (LocalGame).
  return (
    <div className={SETUP_WRAP}>
      <div className="min-[900px]:hidden">
        <SetupTabs tab={setupTab} onChange={setSetupTab} />
      </div>

      <div className={SETUP_GRID}>
        <div className={clsx(T.card, panelClass(setupTab === "players"))}>
          <span className={T.label}>Jugadores ({players.length})</span>
          {players.map(p => (
            <div key={p.id} className="mb-2 flex items-center gap-2">
              <Avatar name={p.name} size={32} />
              <input className={clsx(T.input, "flex-1 min-w-0")} value={p.name} onChange={e => renamePlayer(p.id, e.target.value)} />
              <button
                type="button"
                onClick={() => removePlayer(p.id)}
                aria-label={`Quitar a ${p.name}`}
                className={T.squareIconBtn("danger")}
              >
                ×
              </button>
            </div>
          ))}
          {/* El input se lleva el ancho que sobra y "Agregar" queda a su medida:
              el `!` le gana al `w-full`/`px-7` base de Btn (ver T.btn). */}
          <div className="mt-2.5 flex gap-2">
            <input
              aria-label="Nombre del jugador nuevo"
              className={clsx(T.input, "min-w-0 flex-1")}
              placeholder="Nombre"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") addPlayer();
              }}
            />
            <Btn variant="ghost" onClick={addPlayer} className="w-auto! flex-none px-[18px]! py-[11px]!">
              Agregar
            </Btn>
          </div>
          <ErrorBanner message={nameError} flashKey={nameErrorKey} variant="inline" />
        </div>

        <div className={panelClass(setupTab === "config")}>
          <div className={T.card}>
            <CategoryPicker enabled={enabledCategories} onChange={setEnabledCategories} />
          </div>

          <CustomWordsEditor words={customWords} onChange={setCustomWords} />

          <RoundsPicker value={totalRounds} onChange={setTotalRounds} />
        </div>
      </div>

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
  );
}
