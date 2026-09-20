import { useEffect, useRef, useState } from "react";
import "./css/index.css";
import type { RoundViewProps } from "../gameTypes";
import type { TutifrutiRoundState } from "./types/roundView";
import { SetupPhase } from "./components/SetupPhase";
import { WritingPhase } from "./components/WritingPhase";
import { ReviewPhase } from "./components/ReviewPhase";
import { ResultPhase } from "./components/ResultPhase";
import { PhaseReveal } from "./components/PhaseReveal";
import { RoundIntro } from "./components/RoundIntro";
import { ReviewIntro } from "./components/ReviewIntro";

export function RoundView({ room, me, myPlayer, myRole, isHost, send }: RoundViewProps) {
  // Ambas cuentas regresivas son puramente visuales (el servidor ya movió
  // room.phase en cuanto corresponde) — este estado retiene el swap a la
  // fase de verdad mientras se muestran. Solo se disparan en la transición
  // exacta que les toca, no en cualquier otro cambio hacia esa fase.
  const prevPhaseRef = useRef(room.phase);
  const [showWritingIntro, setShowWritingIntro] = useState(false);
  const [showReviewIntro, setShowReviewIntro] = useState(false);
  useEffect(() => {
    if (prevPhaseRef.current === "setup" && room.phase === "writing") setShowWritingIntro(true);
    if (prevPhaseRef.current === "writing" && room.phase === "review") setShowReviewIntro(true);
    prevPhaseRef.current = room.phase;
  }, [room.phase]);

  if (!room.round) return null;

  if (room.phase === "writing" && showWritingIntro) {
    return (
      <PhaseReveal phaseKey="writing-intro" direction="zoom">
        <RoundIntro round={room.round as TutifrutiRoundState} onDone={() => setShowWritingIntro(false)} />
      </PhaseReveal>
    );
  }
  if (room.phase === "review" && showReviewIntro) {
    return (
      <PhaseReveal phaseKey="review-intro" direction="zoom">
        <ReviewIntro onDone={() => setShowReviewIntro(false)} />
      </PhaseReveal>
    );
  }

  if (room.phase === "setup") {
    return (
      <PhaseReveal phaseKey="setup" direction="zoom">
        <SetupPhase room={room} isHost={isHost} send={send} />
      </PhaseReveal>
    );
  }
  if (room.phase === "writing") {
    return (
      <PhaseReveal phaseKey="writing" direction="right">
        <WritingPhase room={room} me={me} myPlayer={myPlayer} myRole={myRole} isHost={isHost} send={send} />
      </PhaseReveal>
    );
  }
  if (room.phase === "review") {
    return (
      <PhaseReveal phaseKey="review" direction="up">
        <ReviewPhase room={room} me={me} send={send} />
      </PhaseReveal>
    );
  }
  if (room.phase === "result") return <ResultPhase room={room} isHost={isHost} send={send} />;
  return null;
}
