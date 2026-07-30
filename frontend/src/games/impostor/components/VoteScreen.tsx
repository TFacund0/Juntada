import { S } from "../../../theme/styles";
import { Btn } from "../../../components/Btn";
import { Avatar } from "../../../components/Avatar";
import { CluesReview } from "./CluesReview";
import type { LocalPlayer, Round } from "../types/localGame";

interface VoteScreenProps {
  round: Round;
  players: LocalPlayer[];
  clues: Record<number, string>;
  selection: Record<number, number>;
  setSelection: (updater: (prev: Record<number, number>) => Record<number, number>) => void;
  votes: Record<number, number>;
  confirmVote: (voterId: number) => void;
}

// The voting phase: each still-alive player picks a suspect and confirms
// independently (own card, own "Confirmar voto") — a tie repeats the vote
// among just the tied suspects (revoteCandidates), same as the online engine.
export function VoteScreen({ round, players, clues, selection, setSelection, votes, confirmVote }: VoteScreenProps) {
  const alive = players.filter(p => round.voters.includes(p.id));
  const revoteCandidates = round.revoteCandidates;
  return (
    <div>
      <CluesReview clues={clues} players={players} label="Pistas" />
      {revoteCandidates && (
        <div style={{ ...S.card, textAlign: "center", border: "1px solid rgba(226,196,74,0.35)", background: "rgba(226,196,74,0.08)" }}>
          <p style={{ fontSize: 14, color: "#E2C44A", fontWeight: 700, margin: 0 }}>Hubo un empate</p>
          <p style={{ ...S.muted, margin: "4px 0 0" }}>Se vota de nuevo, solo entre quienes empataron</p>
        </div>
      )}
      {alive.map(voter => {
        const confirmed = votes[voter.id] != null;
        const pending = selection[voter.id];
        return (
          <div key={voter.id} style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: confirmed ? 0 : 12 }}>
              <Avatar name={voter.name} size={28} />
              <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{voter.name} sospecha de:</span>
              {confirmed && <span style={S.pill(true)}>Confirmado</span>}
            </div>
            {!confirmed && (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {alive
                    .filter(p => p.id !== voter.id && (!revoteCandidates || revoteCandidates.includes(p.id)))
                    .map(suspect => (
                      <button
                        key={suspect.id}
                        onClick={() => setSelection(s => ({ ...s, [voter.id]: suspect.id }))}
                        style={{
                          ...S.btn(pending === suspect.id ? "danger" : "ghost"),
                          width: "auto",
                          padding: "8px 14px",
                          fontSize: 13,
                          borderRadius: 8,
                        }}
                      >
                        {suspect.name}
                      </button>
                    ))}
                </div>
                <Btn variant="success" disabled={!pending} onClick={() => confirmVote(voter.id)} style={{ marginTop: 10 }}>
                  Confirmar voto
                </Btn>
              </>
            )}
          </div>
        );
      })}
      <p style={{ ...S.muted, textAlign: "center" }}>Faltan {alive.length - Object.keys(votes).length} confirmaciones</p>
    </div>
  );
}
