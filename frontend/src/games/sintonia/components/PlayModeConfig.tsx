import clsx from "clsx";
import { T } from "../../../theme/styles/classes";

// Shared "¿Cómo se juega?" editor — identical copy/layout in the online
// lobby's ConfigPanel and local mode's setup screen (both just wire it to
// their own way of persisting playMode/roundLimit), so a rules tweak only
// ever has to happen in one place.
export function PlayModeConfig({
  playMode,
  roundLimit,
  onChange,
}: {
  playMode: "endless" | "rounds";
  roundLimit: number;
  onChange: (patch: { playMode?: "endless" | "rounds"; roundLimit?: number }) => void;
}) {
  return (
    <div className={T.card}>
      <span className={T.label}>¿Cómo se juega?</span>
      <p className={clsx(T.muted, "mb-2.5 leading-[1.4]")}>
        Define cuándo termina la partida: sigue rotando de psíquico ronda tras ronda sin parar, o corta después de una cantidad fija de
        rondas y muestra quién ganó.
      </p>
      <div className={clsx("flex gap-2", playMode === "rounds" ? "mb-3.5" : "mb-0")}>
        <button
          onClick={() => onChange({ playMode: "endless" })}
          className={clsx(T.btn(playMode === "endless" ? "primary" : "ghost"), "flex-1 p-2 text-[13px]")}
        >
          Libre (sin límite)
        </button>
        <button
          onClick={() => onChange({ playMode: "rounds" })}
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
            onChange={e => onChange({ roundLimit: +e.target.value })}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}
