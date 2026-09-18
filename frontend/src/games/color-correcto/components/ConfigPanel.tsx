import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import type { ConfigPanelProps } from "../../gameTypes";
import { GuessTimerConfig } from "./GuessTimerConfig";

// Host-only rules editor shown in the multiplayer lobby: whether the game
// keeps going indefinitely (running scoreboard) or ends after a fixed
// number of rounds, showing a winner and letting the host start fresh, plus
// whether there's a time limit to guess each round.
export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const config = room.config as { playMode?: "endless" | "rounds"; roundLimit?: number; guessSeconds?: number };
  const playMode = config.playMode || "endless";
  const roundLimit = config.roundLimit || 5;
  const guessSeconds = config.guessSeconds ?? 0;

  return (
    <div>
      <div className={T.card}>
        <span className={T.label}>¿Cómo se juega?</span>
        <p className={clsx(T.muted, "mb-2.5 leading-[1.4]")}>
          Define cuándo termina la partida: sigue sumando rondas sin parar, o corta después de una cantidad fija de rondas y muestra quién
          ganó.
        </p>
        <div className={clsx("flex gap-2", playMode === "rounds" ? "mb-3.5" : "mb-0")}>
          <button
            onClick={() => updateConfig({ playMode: "endless" })}
            className={clsx(T.btn(playMode === "endless" ? "primary" : "ghost"), "flex-1 p-2 text-[13px]")}
          >
            Libre (sin límite)
          </button>
          <button
            onClick={() => updateConfig({ playMode: "rounds" })}
            className={clsx(T.btn(playMode === "rounds" ? "primary" : "ghost"), "flex-1 p-2 text-[13px]")}
          >
            Por rondas
          </button>
        </div>
        {playMode === "rounds" && (
          <div>
            <span className={T.label}>Cantidad de rondas: {roundLimit}</span>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={roundLimit}
              onChange={e => updateConfig({ roundLimit: +e.target.value })}
              className="w-full"
            />
          </div>
        )}
      </div>

      <GuessTimerConfig guessSeconds={guessSeconds} onChange={secs => updateConfig({ guessSeconds: secs })} />
    </div>
  );
}
