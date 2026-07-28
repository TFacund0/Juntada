import { useState, useEffect } from "react";
import { PhaseTransition } from "../../../components/PhaseTransition";
import type { RoundViewProps } from "../../gameTypes";
import type { TutifrutiRoundState } from "../types";
import { RoundResult } from "./RoundResult";
import { FinalResultsLoading } from "./FinalResultsLoading";
import { FinalStandings } from "./FinalStandings";

export function ResultPhase({ room, isHost, send }: Pick<RoundViewProps, "room" | "isHost" | "send">) {
  const round = room.round as TutifrutiRoundState;
  const [finalStage, setFinalStage] = useState<"round" | "loading" | "final">("round");

  useEffect(() => {
    if (finalStage !== "loading") return;
    const id = setTimeout(() => setFinalStage("final"), 1100);
    return () => clearTimeout(id);
  }, [finalStage]);

  if (round.isFinalRound && finalStage === "loading") {
    return (
      <PhaseTransition phaseKey="loading">
        <FinalResultsLoading />
      </PhaseTransition>
    );
  }
  if (round.isFinalRound && finalStage === "final") {
    return (
      <PhaseTransition phaseKey="final">
        <FinalStandings room={room} round={round} isHost={isHost} send={send} />
      </PhaseTransition>
    );
  }
  return (
    <PhaseTransition phaseKey={`round-${round.roundNumber}`}>
      <RoundResult room={room} round={round} isHost={isHost} onShowFinal={() => setFinalStage("loading")} send={send} />
    </PhaseTransition>
  );
}
