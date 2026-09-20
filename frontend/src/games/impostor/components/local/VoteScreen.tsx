import type { CSSProperties } from "react";
import clsx from "clsx";
import { T } from "../../../../theme/styles/classes";
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

      <div className="mb-5 text-center">
        <p className="m-0 mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jt-accent,#e0202b)]">Votación</p>
        <h2 className="m-0 mb-2 text-2xl font-extrabold tracking-[-0.02em]">¿Quién es el impostor?</h2>
        <p className={clsx(T.muted, "mx-auto my-0 max-w-[300px] leading-[1.5]")}>
          Cada uno vota a quién sospecha y confirma antes de pasar el dispositivo.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-[3px] bg-white/[0.08]">
          <div
            className="h-full rounded-[3px] bg-[#5DCAA5] transition-[width] duration-[400ms]"
            style={{ width: `${Math.round((confirmedCount / alive.length) * 100)}%` }}
          />
        </div>
        <span className="whitespace-nowrap text-xs font-bold text-[var(--jt-muted-text)]">
          {confirmedCount}/{alive.length}
        </span>
      </div>

      {revoteCandidates && (
        <div className={clsx(T.card, "border border-[rgba(226,196,74,0.35)] bg-[rgba(226,196,74,0.08)] text-center")}>
          <p className="m-0 text-sm font-bold text-[#E2C44A]">Hubo un empate</p>
          <p className={clsx(T.muted, "m-0 mt-1")}>Se vota de nuevo, solo entre quienes empataron</p>
        </div>
      )}

      {alive.map((voter, i) => {
        const confirmed = votes[voter.id] != null;
        const pending = selection[voter.id];
        if (confirmed) {
          return (
            <div key={voter.id} className={clsx("impostor-vote-card flex items-center gap-2.5 px-4 py-2.5 opacity-60", T.card)}>
              <Avatar name={voter.name} size={26} />
              <span className="flex-1 text-[13px] font-bold">{voter.name}</span>
              <span className={T.pill(true)}>✓ Confirmado</span>
            </div>
          );
        }
        return (
          <div key={voter.id} className={clsx("impostor-vote-card", T.card)} style={{ animationDelay: `${i * 0.03}s` }}>
            <div className="mb-3 flex items-center gap-2">
              <Avatar name={voter.name} size={32} />
              <span className="text-[15px] font-extrabold">{voter.name} sospecha de...</span>
            </div>
            <div className="mb-3">
              <SuspectGrid
                suspects={alive
                  .filter(p => !revoteCandidates || revoteCandidates.includes(p.id))
                  .map(p => ({ id: String(p.id), name: p.id === voter.id ? `${p.name} (vos)` : p.name }))}
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
