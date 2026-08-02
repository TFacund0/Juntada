import { S } from "../../../../theme/styles";

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
  const winnerColor = winner === "innocents" ? "#5DCAA5" : "#F09595";

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <p
          style={{
            margin: "0 0 6px",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--jt-accent, #e0202b)",
          }}
        >
          {matchOver ? "Partida terminada" : "Terminó la votación"}
        </p>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
          {matchOver ? "Así votó el grupo" : `${eliminatedName ?? "Alguien"} quedó eliminado`}
        </h2>
      </div>

      {matchOver && (
        <p style={{ textAlign: "center", margin: "0 0 16px", fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", color: winnerColor }}>
          {winner === "innocents"
            ? "¡Ganaron los inocentes!"
            : impostorNames.length === 1
              ? "¡Ganó el impostor!"
              : "¡Ganaron los impostores!"}
        </p>
      )}

      {matchOver && (
        <div style={S.card}>
          <p style={{ margin: word ? "0 0 8px" : 0, fontSize: 14 }}>
            <span style={{ ...S.muted, fontSize: 13 }}>{impostorNames.length === 1 ? "El impostor era" : "Los impostores eran"}: </span>
            <strong style={{ color: "#e8e4f0" }}>{impostorNames.join(", ")}</strong>
          </p>
          {word && (
            <p style={{ margin: 0, fontSize: 14 }}>
              <span style={{ ...S.muted, fontSize: 13 }}>La palabra era: </span>
              <strong style={{ color: "#e8e4f0" }}>{word}</strong>
            </p>
          )}
        </div>
      )}
    </>
  );
}
