import type { CSSProperties } from "react";
import { Btn } from "../../../../components/Btn";
import { S } from "../../../../theme/styles";
import { StickyActionBar } from "../../../../components/StickyActionBar";
import { RingTimer } from "../shared/RingTimer";
import { ClueHistoryCard } from "./ClueHistoryCard";
import { actionBtnStyle } from "../shared/actionBtnStyle";
import type { LocalPlayer, Config } from "../../types/localGame";

interface DiscussionScreenProps {
  config: Config;
  clueHistory: Record<number, Record<number, string>>;
  players: LocalPlayer[];
  timeLeft: number;
  onGoToVote: () => void;
}

// The discussion phase: a big centered countdown ring (unless the host set
// it unlimited) instead of a thin bar up top, so the timer actually fills
// the screen instead of leaving dead space above/below — with a
// pulsing/vibrating warning near the end, since a pass-around device means
// nobody's necessarily looking at the screen right when time runs out —
// unlike online, where each player has their own device to glance at. "Ir a
// votación" stays pinned at the bottom like every other phase's action.
export function DiscussionScreen({ config, clueHistory, players, timeLeft, onGoToVote }: DiscussionScreenProps) {
  return (
    <div style={{ minHeight: "calc(100dvh - 140px)", display: "flex", flexDirection: "column", paddingBottom: 88 }}>
      <style>{actionBtnStyle}</style>
      <style>{`
        .impostor-discussion-vote-btn {
          transition: background 0.2s ease-out, border-color 0.2s ease-out, color 0.2s ease-out;
        }
        .impostor-discussion-vote-btn:hover {
          background: rgba(224,75,74,0.15);
          border-color: #E24B4A;
          color: #FF8A8A;
        }
        .impostor-discussion-vote-btn:active {
          background: rgba(224,75,74,0.28);
          border-color: #E24B4A;
          color: #fff;
        }
      `}</style>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 0 }}>
        {!config.discussionUnlimited ? (
          <RingTimer timeLeft={timeLeft} total={config.discussionTime} label="Tiempo de discusión" />
        ) : (
          <p style={{ ...S.muted, textAlign: "center", marginBottom: 16 }}>Sin límite de tiempo — discutan a su ritmo.</p>
        )}

        {config.writtenClues ? (
          <ClueHistoryCard clueHistory={clueHistory} players={players} />
        ) : (
          <p style={{ ...S.muted, textAlign: "center", marginBottom: 16 }}>Repasen entre todos lo que dijo cada uno antes de votar.</p>
        )}
      </div>

      <StickyActionBar>
        <Btn
          variant="ghost"
          onClick={onGoToVote}
          className="impostor-action-btn impostor-discussion-vote-btn"
          style={{ "--impostor-action-glow": "rgba(224,75,74,0.3)" } as CSSProperties}
        >
          Empezar votación
        </Btn>
      </StickyActionBar>
    </div>
  );
}
