import { S } from "../../../../theme/styles";
import { Avatar } from "../../../../components/Avatar";

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
    <div style={S.card}>
      <span style={S.label}>Votos</span>
      <div className="impostor-result-votes-scroll" style={{ maxHeight: 280, overflowY: "auto" }}>
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
            <div key={p.id} style={{ padding: "10px 0", borderTop: "1px solid var(--jt-card-border, rgba(127,119,221,0.12))" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <Avatar name={p.name} size={30} />
                <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{p.name}</span>
                {isEliminated && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.04em",
                      color: "#F09595",
                      background: "rgba(240,149,149,0.15)",
                      border: "1px solid rgba(240,149,149,0.4)",
                      borderRadius: 999,
                      padding: "3px 9px",
                    }}
                  >
                    ELIMINADO
                  </span>
                )}
                <span style={{ ...S.muted, fontSize: 12, minWidth: 44, textAlign: "right" }}>
                  {count} {count === 1 ? "voto" : "votos"}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
                <div
                  style={{
                    height: "100%",
                    borderRadius: 3,
                    width: `${Math.round((count / maxCount) * 100)}%`,
                    background: isEliminated ? "#E24B4A" : "var(--jt-accent-border-soft, rgba(127,119,221,0.5))",
                    transition: "width 0.6s",
                  }}
                />
              </div>
              {voterNames.length > 0 && <p style={{ ...S.muted, marginTop: 6, fontSize: 12 }}>Votado por: {voterNames.join(", ")}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
