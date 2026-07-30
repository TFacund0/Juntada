import { S } from "../../../theme/styles";
import { Btn } from "../../../components/Btn";
import { Avatar } from "../../../components/Avatar";
import { Timer } from "../../../components/Timer";
import { PhaseTransition } from "../../../components/PhaseTransition";
import { CluesReview } from "./CluesReview";
import type { RoundViewProps } from "../../gameTypes";
import type { ImpostorRoundState } from "../types/roundView";

interface VotingPhaseScreenProps {
  room: RoundViewProps["room"];
  me: RoundViewProps["me"];
  send: RoundViewProps["send"];
  round: ImpostorRoundState | null;
  selectedSuspect: string | null;
  setSelectedSuspect: (id: string) => void;
  voteConfirmed: boolean;
  setVoteConfirmed: (value: boolean) => void;
}

// The voting phase: pick a suspect and confirm — a tie repeats the vote
// among just the tied suspects (revoteCandidates). Shows a live countdown
// for any still-alive player who's currently offline, mirroring the
// backend's own shortened auto-kick timeout during voting (engine.ts's
// offlineKickTimeoutMs) — purely informational, the kick itself is
// server-side and happens regardless of this countdown.
export function VotingPhaseScreen({
  room,
  me,
  send,
  round,
  selectedSuspect,
  setSelectedSuspect,
  voteConfirmed,
  setVoteConfirmed,
}: VotingPhaseScreenProps) {
  // Only online players are ever required to vote (see engine.ts's
  // maybeAdvance) — counting offline ones in the denominator would make the
  // tally look permanently stuck a vote short.
  const onlinePlayers = room.players.filter(p => p.online);
  const totalVoted = onlinePlayers.filter(p => p.hasVoted).length;
  const revoteCandidates: string[] | null | undefined = round?.revoteCandidates;
  const isRevote = !!revoteCandidates;
  // Players eliminated earlier in this same match are spectating, not
  // votable — the backend rejects a vote for one of them outright (see
  // engine.ts's `vote` handler checking `alive.includes(suspectId)`), so
  // offering them here would just silently eat the tap with no feedback,
  // and if everyone hits this the round can never reach the vote quorum.
  const matchEliminated: string[] = round?.matchEliminated ?? [];
  const suspects = room.players.filter(
    p => p.id !== me?.playerId && !matchEliminated.includes(p.id) && (!revoteCandidates || revoteCandidates.includes(p.id)),
  );
  // Still-alive players who happen to be offline right now aren't counted in
  // the vote quorum (see the comment above), but that also means the vote is
  // effectively paused waiting for them to come back — worth saying so
  // explicitly instead of just showing a tally that looks "complete" while
  // actually waiting on someone.
  const offlineAlive = room.players.filter(p => !matchEliminated.includes(p.id) && !p.online);
  const earliestOfflineSince = offlineAlive.reduce<number | null>((min, p) => {
    const since = p.offlineSince;
    if (since == null) return min;
    return min == null ? since : Math.min(min, since);
  }, null);
  const reconnectDeadline = earliestOfflineSince != null ? earliestOfflineSince + 5 * 60 * 1000 : null;

  const confirmVote = () => {
    if (!selectedSuspect) return;
    send({ type: "vote", suspectId: selectedSuspect });
    setVoteConfirmed(true);
  };

  return (
    <PhaseTransition phaseKey={`voting-${round?.revoteCount ?? 0}`}>
      <div>
        {isRevote && (
          <div style={{ ...S.card, textAlign: "center", border: "1px solid rgba(226,196,74,0.35)", background: "rgba(226,196,74,0.08)" }}>
            <p style={{ fontSize: 14, color: "#E2C44A", fontWeight: 700, margin: 0 }}>Hubo un empate</p>
            <p style={{ fontSize: 13, color: "var(--jt-muted-text)", marginTop: 4 }}>Se vota de nuevo solo entre los más votados</p>
          </div>
        )}

        {offlineAlive.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ ...S.muted, textAlign: "center", marginBottom: 8 }}>
              Esperando a que se reconecte{offlineAlive.length === 1 ? "" : "n"} {offlineAlive.map(p => p.name).join(", ")} — la votación
              sigue pausada hasta que vuelva{offlineAlive.length === 1 ? "" : "n"}.
            </p>
            {reconnectDeadline != null && <Timer timerEnd={reconnectDeadline} total={5 * 60} label="Se lo/a expulsa en" />}
          </div>
        )}

        <CluesReview clues={round?.clues} players={room.players} />

        {!voteConfirmed ? (
          <>
            <div style={S.card}>
              <span style={S.label}>Elegí a quién sospechás</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {suspects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedSuspect(p.id)}
                    style={{
                      ...S.btn(selectedSuspect === p.id ? "danger" : "ghost"),
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 12px",
                      textAlign: "left",
                      borderRadius: 10,
                    }}
                  >
                    <Avatar name={p.name} size={28} />
                    <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>
                      {p.name}
                      {!p.online && <span style={{ fontWeight: 600, fontSize: 12, color: "var(--jt-muted-text)" }}> · desconectado</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <Btn variant="success" disabled={!selectedSuspect} onClick={confirmVote}>
              Confirmar voto
            </Btn>
            <p style={{ ...S.muted, textAlign: "center", marginTop: 10 }}>
              Votos confirmados: {totalVoted}/{onlinePlayers.length}
            </p>
          </>
        ) : (
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ fontSize: 15, color: "var(--jt-muted-text)" }}>Voto confirmado. Esperando a los demás</p>
            <p style={{ fontSize: 13, color: "var(--jt-muted-text)", marginTop: 6 }}>
              Votos confirmados: {totalVoted}/{onlinePlayers.length}
            </p>
          </div>
        )}
      </div>
    </PhaseTransition>
  );
}
