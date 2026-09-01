import clsx from "clsx";
import { T } from "../../../../theme/styles/classes";
import { Avatar } from "../../../../components/ui/Avatar";

interface VotesBreakdownParticipant {
  id: string;
  name: string;
}

interface VotesBreakdownCardProps {
  participants: VotesBreakdownParticipant[];
  votes: Record<string, string>; // voterId -> suspectId
  eliminatedId?: string | null;
}

// The "who voted for whom" card at the end of a vote — sorted most-to-least
// votes, with an ELIMINADO badge and a proportional bar per row, scrolling
// internally (hidden scrollbar) instead of stretching the card for a big
// roster. Shared by LocalGame's ResultScreen and online's ResultPhaseScreen
// — each just normalizes its own vote-tracking shape (local's
// votesByVoter, online's raw round.votes) into the same voterId ->
// suspectId map before handing it here.
export function VotesBreakdownCard({ participants, votes, eliminatedId }: VotesBreakdownCardProps) {
  const countFor = (id: string) => Object.values(votes).filter(v => v === id).length;
  const sorted = [...participants].sort((a, b) => countFor(b.id) - countFor(a.id));
  const maxCount = Math.max(1, ...participants.map(p => countFor(p.id)));

  return (
    <div className={T.card}>
      <span className={T.label}>Votos</span>
      <div className="impostor-result-votes-scroll max-h-[280px] overflow-y-auto">
        <style>{`
          .impostor-result-votes-scroll {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .impostor-result-votes-scroll::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {sorted.map(p => {
          const count = countFor(p.id);
          const voterNames = participants.filter(v => votes[v.id] === p.id).map(v => v.name);
          const isEliminated = p.id === eliminatedId;
          return (
            <div key={p.id} className="py-2.5 border-t border-[var(--jt-card-border,rgba(127,119,221,0.12))]">
              <div className="flex items-center gap-2.5 mb-1.5">
                <Avatar name={p.name} size={30} />
                <span className="text-sm font-bold flex-1">{p.name}</span>
                {isEliminated && (
                  <span className="text-[10px] font-extrabold tracking-[0.04em] text-[#F09595] bg-[rgba(240,149,149,0.15)] border border-[rgba(240,149,149,0.4)] rounded-full px-[9px] py-[3px]">
                    ELIMINADO
                  </span>
                )}
                <span className={clsx(T.muted, "text-xs min-w-[44px] text-right")}>
                  {count} {count === 1 ? "voto" : "votos"}
                </span>
              </div>
              <div className="h-1.5 rounded-[3px] bg-white/[0.08]">
                <div
                  className={clsx(
                    "h-full rounded-[3px] transition-[width] duration-[600ms]",
                    isEliminated ? "bg-[#E24B4A]" : "bg-[var(--jt-accent-border-soft,rgba(127,119,221,0.5))]",
                  )}
                  style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                />
              </div>
              {voterNames.length > 0 && <p className={clsx(T.muted, "mt-1.5 text-xs")}>Votado por: {voterNames.join(", ")}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
