import { S } from "../../../theme/styles";
import { Btn } from "../../../components/Btn";
import { CluesReview } from "./CluesReview";
import type { LocalPlayer, Config } from "../types/localGame";

interface DiscussionScreenProps {
  config: Config;
  clues: Record<number, string>;
  players: LocalPlayer[];
  timeLeft: number;
  onGoToVote: () => void;
}

// The discussion phase: a countdown (unless the host set it unlimited) with
// a pulsing/vibrating warning near the end, since a pass-around device means
// nobody's necessarily looking at the screen right when time runs out —
// unlike online, where each player has their own device to glance at.
export function DiscussionScreen({ config, clues, players, timeLeft, onGoToVote }: DiscussionScreenProps) {
  const urgent = timeLeft > 0 && timeLeft <= 5;
  return (
    <div>
      <style>{`
        @keyframes discussion-urgent-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
      `}</style>
      {!config.discussionUnlimited && (
        <div style={{ ...S.card, animation: urgent ? "discussion-urgent-pulse 0.5s ease-in-out infinite" : undefined }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "var(--jt-muted-text)" }}>Tiempo restante</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: timeLeft < 15 ? "#E24B4A" : timeLeft < 30 ? "#EF9F27" : "#5DCAA5" }}>
              {timeLeft}s
            </span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 3,
                width: `${Math.round((timeLeft / config.discussionTime) * 100)}%`,
                background: timeLeft < 15 ? "#E24B4A" : timeLeft < 30 ? "#EF9F27" : "#5DCAA5",
                transition: "width 1s, background 0.5s",
              }}
            />
          </div>
        </div>
      )}
      {config.writtenClues ? (
        <CluesReview clues={clues} players={players} label="Pistas" />
      ) : (
        <p style={{ ...S.muted, textAlign: "center", marginBottom: 16 }}>Repasen entre todos lo que dijo cada uno antes de votar.</p>
      )}
      <Btn variant="ghost" onClick={onGoToVote}>
        Ir a votación
      </Btn>
    </div>
  );
}
