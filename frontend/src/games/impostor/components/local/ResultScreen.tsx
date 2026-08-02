import type { CSSProperties } from "react";
import { StartButton } from "../../../../components/setup/StartButton";
import { StickyActionBar } from "../../../../components/setup/StickyActionBar";
import { ErrorBanner } from "../../../../components/ui/ErrorBanner";
import { EliminationRevealOverlay, MatchOutcomeOverlay } from "../shared/EliminationRevealOverlay";
import { MatchResultHeader } from "../shared/MatchResultHeader";
import { VotesBreakdownCard } from "../shared/VotesBreakdownCard";
import { actionBtnStyle } from "../shared/actionBtnStyle";
import type { LocalPlayer, Round, Config } from "../../types/localGame";

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
      <MatchOutcomeOverlay winner={winner} impostorNames={impostorPlayers.map(p => p.name)} onContinue={() => setRevealStep("done")} />
    );
  }

  // votesByVoter is already the same voterId -> suspectId shape
  // VotesBreakdownCard expects, just numeric-keyed instead of string-keyed
  // (JS object keys are strings either way at runtime).
  const votes: Record<string, string> = {};
  Object.entries(round.votesByVoter ?? {}).forEach(([voterId, suspectId]) => {
    votes[voterId] = String(suspectId);
  });

  return (
    <div style={{ paddingBottom: 88 }}>
      <style>{actionBtnStyle}</style>

      <MatchResultHeader
        matchOver={matchOver}
        eliminatedName={eliminated?.name}
        winner={winner}
        impostorNames={impostorPlayers.map(p => p.name)}
        word={matchOver ? round.word : undefined}
      />

      <VotesBreakdownCard
        participants={voters.map(p => ({ id: String(p.id), name: p.name }))}
        votes={votes}
        eliminatedId={round.eliminated != null ? String(round.eliminated) : null}
      />

      <StickyActionBar>
        {matchOver ? (
          <StartButton
            onClick={onNewMatch}
            className="impostor-action-btn"
            style={{ "--impostor-action-glow": "rgba(93,202,165,0.35)" } as CSSProperties}
          >
            Nueva partida
          </StartButton>
        ) : (
          <StartButton
            onClick={continueMatch}
            className="impostor-action-btn"
            style={{ "--impostor-action-glow": "rgba(93,202,165,0.35)" } as CSSProperties}
          >
            Siguiente ronda
          </StartButton>
        )}
        <ErrorBanner message={wordError} flashKey={wordErrorKey} variant="inline" />
      </StickyActionBar>
    </div>
  );
}
