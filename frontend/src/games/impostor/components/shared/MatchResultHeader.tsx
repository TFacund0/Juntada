import clsx from "clsx";
import { T } from "../../../../theme/styles/classes";

interface MatchResultHeaderProps {
  matchOver: boolean;
  eliminatedName?: string;
  winner: "innocents" | "impostors" | null;
  impostorNames: string[];
  // Only shown once the match is actually over (see engine.ts's
  // revealOnElimination) — undefined for a still-ongoing match.
  word?: string;
}

// The eyebrow+title, winner banner, and impostors/word card shown once the
// vote-reveal overlays are dismissed — shared by LocalGame's ResultScreen
// and online's ResultPhaseScreen so a wording tweak only happens once.
export function MatchResultHeader({ matchOver, eliminatedName, winner, impostorNames, word }: MatchResultHeaderProps) {
  return (
    <>
      <div className="text-center mb-5">
        <p className="mb-1.5 text-[11px] font-extrabold tracking-[0.12em] uppercase text-[var(--jt-accent,#e0202b)]">
          {matchOver ? "Partida terminada" : "Terminó la votación"}
        </p>
        <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">
          {matchOver ? "Así votó el grupo" : `${eliminatedName ?? "Alguien"} quedó eliminado`}
        </h2>
      </div>

      {matchOver && (
        <p
          className={clsx(
            "text-center mb-4 text-[22px] font-extrabold tracking-[-0.01em]",
            winner === "innocents" ? "text-[#5DCAA5]" : "text-[#F09595]",
          )}
        >
          {winner === "innocents"
            ? "¡Ganaron los inocentes!"
            : impostorNames.length === 1
              ? "¡Ganó el impostor!"
              : "¡Ganaron los impostores!"}
        </p>
      )}

      {matchOver && (
        <div className={T.card}>
          <p className={clsx("text-sm", word ? "mb-2" : "m-0")}>
            <span className={clsx(T.muted, "text-[13px]")}>{impostorNames.length === 1 ? "El impostor era" : "Los impostores eran"}: </span>
            <strong className="text-[#e8e4f0]">{impostorNames.join(", ")}</strong>
          </p>
          {word && (
            <p className="text-sm">
              <span className={clsx(T.muted, "text-[13px]")}>La palabra era: </span>
              <strong className="text-[#e8e4f0]">{word}</strong>
            </p>
          )}
        </div>
      )}
    </>
  );
}
