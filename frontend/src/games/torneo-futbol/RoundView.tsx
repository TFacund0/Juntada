import { RevealCountdown, useRevealCountdown } from "../../components/game-kit/RevealCountdown";
import { PhaseTransition } from "../../components/game-kit/PhaseTransition";
import type { RoundViewProps } from "../gameTypes";
import type { Match } from "./types";
import { ChampionPhase } from "./components/ChampionPhase";
import { BracketPhase } from "./components/BracketPhase";

// ═══════════════════════════════════════════════════════════════════════════════
// TORNEO DE FÚTBOL — vista compartida del bracket en modo online. Todos los que
// están en la sala ven los mismos cruces y resultados en vivo; solo el
// anfitrión puede cargar el resultado de un partido (send "report_result").
// ═══════════════════════════════════════════════════════════════════════════════

export function RoundView({ room, myPlayer, isHost, send }: RoundViewProps) {
  const { rounds, trackGoals } = room.round as { rounds: Match[][]; trackGoals: boolean };
  const champion = room.phase === "champion" ? rounds[rounds.length - 1][0].winner : null;
  // No dedicated tournament counter — total reported matches ticks up as the
  // bracket fills and resets to 0 for a fresh tournament, which is enough to
  // restart the countdown once per championship.
  const matchesReported = rounds.reduce((sum, r) => sum + r.filter(m => m.goalsA != null || m.winner).length, 0);
  const revealCount = useRevealCountdown(matchesReported);

  if (room.phase === "champion" && champion) {
    if (revealCount > 0) return <RevealCountdown count={revealCount} label="Revelando al campeón..." />;
    return (
      <PhaseTransition phaseKey="champion">
        <ChampionPhase
          room={room}
          myPlayer={myPlayer}
          isHost={isHost}
          send={send}
          rounds={rounds}
          trackGoals={trackGoals}
          champion={champion}
        />
      </PhaseTransition>
    );
  }

  const currentRoundIdx = rounds.findIndex(r => r.some(m => !m.winner));
  const activeRoundIdx = currentRoundIdx === -1 ? rounds.length - 1 : currentRoundIdx;

  return (
    <PhaseTransition phaseKey={`bracket-${activeRoundIdx}`}>
      <BracketPhase room={room} myPlayer={myPlayer} isHost={isHost} send={send} rounds={rounds} trackGoals={trackGoals} />
    </PhaseTransition>
  );
}
