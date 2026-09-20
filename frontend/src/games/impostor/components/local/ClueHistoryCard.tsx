import { useState } from "react";
import clsx from "clsx";
import { T } from "../../../../theme/styles/classes";
import type { LocalPlayer } from "../../types/localGame";

interface ClueHistoryCardProps {
  // roundNumber -> playerId -> clue, one entry per lap of clue-giving within
  // the match (see matchRound/clueHistory in LocalGame) — a match that went
  // to a second vote without deciding anything has a second lap with a new
  // set of words for the same investigation.
  clueHistory: Record<number, Record<number, string>>;
  players: LocalPlayer[];
}

// The discussion phase's "what did everyone say" card. A first-round match
// just shows the words, same as always — once there's more than one lap
// (continueMatch), a row of round tabs appears above the list so the group
// can flip back to what was said earlier instead of only ever seeing the
// latest lap.
export function ClueHistoryCard({ clueHistory, players }: ClueHistoryCardProps) {
  const rounds = Object.keys(clueHistory)
    .map(Number)
    .sort((a, b) => a - b);
  const [selected, setSelected] = useState<number | null>(null);
  if (rounds.length === 0) return null;

  const activeRound = selected != null && rounds.includes(selected) ? selected : rounds[rounds.length - 1];
  const entries = Object.entries(clueHistory[activeRound] || {}).filter(([, clue]) => clue);

  return (
    <div className={T.card}>
      <style>{`
        .impostor-clue-history-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .impostor-clue-history-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <span className={T.label}>Palabras de los jugadores</span>
      {rounds.length > 1 && (
        <div className="flex gap-1.5 mb-2.5">
          {rounds.map(r => (
            <button
              key={r}
              onClick={() => setSelected(r)}
              className={clsx(T.btn(r === activeRound ? "primary" : "ghost"), "w-auto! px-3 py-1.5 text-xs rounded-lg")}
            >
              Ronda {r}
            </button>
          ))}
        </div>
      )}
      <div className="impostor-clue-history-scroll max-h-[140px] overflow-y-auto">
        {entries.length === 0 ? (
          <p className={clsx(T.muted, "my-1")}>Nadie escribió su palabra esta ronda.</p>
        ) : (
          entries.map(([playerId, clue]) => {
            const p = players.find(x => String(x.id) === playerId);
            if (!p) return null;
            return (
              <p key={playerId} className="text-sm my-1 text-[var(--jt-muted-text)]">
                <strong className="text-[#FF8A8A]">{p.name}:</strong> {clue}
              </p>
            );
          })
        )}
      </div>
    </div>
  );
}
