import { S } from "../../../theme/styles";
import { StartButton } from "../../../components/StartButton";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { EliminationRevealOverlay, MatchOutcomeOverlay } from "./EliminationRevealOverlay";
import type { LocalPlayer, Round, Config } from "../types/localGame";

interface ResultScreenProps {
  round: Round;
  players: LocalPlayer[];
  config: Config;
  revealStep: "elimination" | "outcome" | "done";
  setRevealStep: (step: "elimination" | "outcome" | "done") => void;
  continueMatch: () => void;
  onNewMatch: () => void;
  wordError: string;
  wordErrorKey: number;
}

// The result screen: two sequential reveal overlays (who got eliminated,
// then — only once the match is over — who won/the word), then the vote
// breakdown and next-match controls, same reveal flow as RoundView's own.
export function ResultScreen({
  round,
  players,
  config,
  revealStep,
  setRevealStep,
  continueMatch,
  onNewMatch,
  wordError,
  wordErrorKey,
}: ResultScreenProps) {
  const eliminated = players.find(p => p.id === round.eliminated);
  const voters = players.filter(p => round.voters.includes(p.id));
  const matchOver = round.matchOver;
  const winner = round.winner;
  // Each elimination reveals the eliminated player's role only if the
  // "revealOnElimination" setting is on — but once the match is over
  // there's nothing left to protect, so the outcome always shows.
  const reveal = config.revealOnElimination || matchOver;
  const wasImpostor = reveal ? round.wasImpostor : undefined;
  const impostorPlayers = players.filter(p => round.impostors.includes(p.id));

  if (revealStep === "elimination") {
    return (
      <EliminationRevealOverlay
        name={eliminated?.name ?? ""}
        wasImpostor={wasImpostor}
        onContinue={() => setRevealStep(matchOver ? "outcome" : "done")}
      />
    );
  }

  if (revealStep === "outcome" && matchOver) {
    return (
      <MatchOutcomeOverlay
        winner={winner}
        impostorNames={impostorPlayers.map(p => p.name)}
        word={round.word}
        onContinue={() => setRevealStep("done")}
      />
    );
  }

  return (
    <div>
      <div style={S.card}>
        <span style={S.label}>Votos</span>
        {voters.map(p => {
          const count = (round.tally || {})[p.id] || 0;
          const total = Math.max(1, voters.length - 1);
          const voterNames = voters.filter(v => (round.votesByVoter || {})[v.id] === p.id).map(v => v.name);
          return (
            <div key={p.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13 }}>{p.name}</span>
                <span style={S.muted}>{count} votos</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
                <div
                  style={{
                    height: "100%",
                    borderRadius: 3,
                    width: `${Math.round((count / total) * 100)}%`,
                    background: p.id === round.eliminated ? "#E24B4A" : "#5a2226",
                    transition: "width 0.6s",
                  }}
                />
              </div>
              {voterNames.length > 0 && <p style={{ ...S.muted, marginTop: 4, fontSize: 12 }}>Votado por: {voterNames.join(", ")}</p>}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {matchOver ? (
          <StartButton onClick={onNewMatch}>Nueva partida</StartButton>
        ) : (
          <StartButton onClick={continueMatch}>Siguiente ronda</StartButton>
        )}
        <ErrorBanner message={wordError} flashKey={wordErrorKey} variant="inline" />
      </div>
    </div>
  );
}
