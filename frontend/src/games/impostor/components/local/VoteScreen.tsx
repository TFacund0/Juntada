import type { CSSProperties } from "react";
import { S } from "../../../../theme/styles";
import { Btn } from "../../../../components/ui/Btn";
import { Avatar } from "../../../../components/ui/Avatar";
import { SuspectGrid } from "../shared/SuspectGrid";
import { actionBtnStyle } from "../shared/actionBtnStyle";
import type { LocalPlayer, Round } from "../../types/localGame";

interface VoteScreenProps {
  round: Round;
  players: LocalPlayer[];
  selection: Record<number, number>;
  setSelection: (updater: (prev: Record<number, number>) => Record<number, number>) => void;
  votes: Record<number, number>;
  confirmVote: (voterId: number) => void;
}

const successGlow = { "--impostor-action-glow": "rgba(93,202,165,0.3)" } as CSSProperties;

// The voting phase: each still-alive player picks a suspect and confirms
// independently (own card, own "Confirmar voto") — a tie repeats the vote
// among just the tied suspects (revoteCandidates), same as the online engine.
// A confirmed voter's card collapses to a slim row so the screen fills up
// with checkmarks instead of staying a wall of identical open cards.
export function VoteScreen({ round, players, selection, setSelection, votes, confirmVote }: VoteScreenProps) {
  const alive = players.filter(p => round.voters.includes(p.id));
  const revoteCandidates = round.revoteCandidates;
  const confirmedCount = Object.keys(votes).length;
  const voteCounts: Record<string, number> = {};
  Object.values(votes).forEach(suspectId => {
    voteCounts[suspectId] = (voteCounts[suspectId] ?? 0) + 1;
  });

  return (
    <div>
      <style>{actionBtnStyle}</style>
      <style>{`
        .impostor-vote-card {
          animation: impostor-vote-card-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
          transition: opacity 0.25s ease-out, padding 0.25s ease-out, background 0.25s ease-out, border-color 0.25s ease-out;
        }
        @keyframes impostor-vote-card-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <p
          style={{
            margin: "0 0 6px",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--jt-accent, #e0202b)",
          }}
        >
          Votación
        </p>
        <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>¿Quién es el impostor?</h2>
        <p style={{ ...S.muted, margin: "0 auto", lineHeight: 1.5, maxWidth: 300 }}>
          Cada uno vota a quién sospecha y confirma antes de pasar el dispositivo.
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
          <div
            style={{
              height: "100%",
              borderRadius: 3,
              width: `${Math.round((confirmedCount / alive.length) * 100)}%`,
              background: "#5DCAA5",
              transition: "width 0.4s",
            }}
          />
        </div>
        <span style={{ fontSize: 12, color: "var(--jt-muted-text)", fontWeight: 700, whiteSpace: "nowrap" }}>
          {confirmedCount}/{alive.length}
        </span>
      </div>

      {revoteCandidates && (
        <div style={{ ...S.card, textAlign: "center", border: "1px solid rgba(226,196,74,0.35)", background: "rgba(226,196,74,0.08)" }}>
          <p style={{ fontSize: 14, color: "#E2C44A", fontWeight: 700, margin: 0 }}>Hubo un empate</p>
          <p style={{ ...S.muted, margin: "4px 0 0" }}>Se vota de nuevo, solo entre quienes empataron</p>
        </div>
      )}

      {alive.map((voter, i) => {
        const confirmed = votes[voter.id] != null;
        const pending = selection[voter.id];
        if (confirmed) {
          return (
            <div
              key={voter.id}
              className="impostor-vote-card"
              style={{
                ...S.card,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                opacity: 0.6,
              }}
            >
              <Avatar name={voter.name} size={26} />
              <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{voter.name}</span>
              <span style={S.pill(true)}>✓ Confirmado</span>
            </div>
          );
        }
        return (
          <div key={voter.id} className="impostor-vote-card" style={{ ...S.card, animationDelay: `${i * 0.03}s` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Avatar name={voter.name} size={32} />
              <span style={{ fontWeight: 800, fontSize: 15 }}>{voter.name} sospecha de...</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <SuspectGrid
                suspects={alive
                  .filter(p => p.id !== voter.id && (!revoteCandidates || revoteCandidates.includes(p.id)))
                  .map(p => ({ id: String(p.id), name: p.name }))}
                selectedId={pending != null ? String(pending) : null}
                onSelect={id => setSelection(s => ({ ...s, [voter.id]: Number(id) }))}
                voteCounts={voteCounts}
              />
            </div>
            <Btn
              variant="success"
              disabled={!pending}
              onClick={() => confirmVote(voter.id)}
              className="impostor-action-btn"
              style={successGlow}
            >
              Confirmar voto
            </Btn>
          </div>
        );
      })}
    </div>
  );
}
