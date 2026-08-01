import { PhaseTransition } from "../../components/game-kit/PhaseTransition";
import type { RoundViewProps } from "../gameTypes";
import { SetupPhase } from "./components/SetupPhase";
import { WritingPhase } from "./components/WritingPhase";
import { ReviewPhase } from "./components/ReviewPhase";
import { ResultPhase } from "./components/ResultPhase";

export function RoundView({ room, me, myPlayer, myRole, isHost, send }: RoundViewProps) {
  if (!room.round) return null;
  if (room.phase === "setup") {
    return (
      <PhaseTransition phaseKey="setup">
        <SetupPhase room={room} isHost={isHost} send={send} />
      </PhaseTransition>
    );
  }
  if (room.phase === "writing") {
    return (
      <PhaseTransition phaseKey="writing">
        <WritingPhase room={room} me={me} myPlayer={myPlayer} myRole={myRole} isHost={isHost} send={send} />
      </PhaseTransition>
    );
  }
  if (room.phase === "review") {
    return (
      <PhaseTransition phaseKey="review">
        <ReviewPhase room={room} me={me} send={send} />
      </PhaseTransition>
    );
  }
  if (room.phase === "result") return <ResultPhase room={room} isHost={isHost} send={send} />;
  return null;
}
