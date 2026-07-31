import type { CSSProperties } from "react";
import { S } from "../../../../theme/styles";
import { Btn } from "../../../../components/ui/Btn";
import { StickyActionBar } from "../../../../components/setup/StickyActionBar";
import { PhaseTransition } from "../../../../components/game-kit/PhaseTransition";
import { CluesReview } from "../shared/CluesReview";
import { SuspectGrid } from "../shared/SuspectGrid";
import { useCountdownSeconds } from "../shared/RingTimer";
import { actionBtnStyle } from "../shared/actionBtnStyle";
import type { RoundViewProps } from "../../../gameTypes";
import type { ImpostorRoundState } from "../../types/roundView";

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

const successGlow = { "--impostor-action-glow": "rgba(93,202,165,0.3)" } as CSSProperties;

// The voting phase: pick a suspect and confirm — a tie repeats the vote
// among just the tied suspects (revoteCandidates). Each suspect card shows a
// live running tally (round.votes is already broadcast to everyone the
// whole time, not just once voting resolves) instead of only revealing
// counts on the result screen. Shows a countdown for any still-alive player
// who's currently offline as an alert banner (same look as the tie banner),
// mirroring the backend's own shortened auto-kick timeout during voting
// (engine.ts's offlineKickTimeoutMs) — purely informational, the kick
// itself is server-side and happens regardless of this countdown.
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
  const votes: Record<string, string> = round?.votes ?? {};
  const voteCounts: Record<string, number> = {};
  Object.values(votes).forEach(suspectId => {
    voteCounts[suspectId] = (voteCounts[suspectId] ?? 0) + 1;
  });
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
  // Always called (hooks can't be conditional) — a stable 0 when nobody's
  // offline just means the number is never actually rendered below.
  const { secs: reconnectSecs } = useCountdownSeconds(reconnectDeadline ?? 0);

  const confirmVote = () => {
    if (!selectedSuspect) return;
    send({ type: "vote", suspectId: selectedSuspect });
    setVoteConfirmed(true);
  };

  return (
    <PhaseTransition phaseKey={`voting-${round?.revoteCount ?? 0}`}>
      <div style={{ paddingBottom: 88 }}>
        <style>{actionBtnStyle}</style>

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
          <p style={{ ...S.muted, margin: "0 auto", lineHeight: 1.5, maxWidth: 300 }}>Elegí a quién sospechás y confirmá tu voto.</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 3,
                width: `${Math.round((totalVoted / Math.max(1, onlinePlayers.length)) * 100)}%`,
                background: "#5DCAA5",
                transition: "width 0.4s",
              }}
            />
          </div>
          <span style={{ fontSize: 12, color: "var(--jt-muted-text)", fontWeight: 700, whiteSpace: "nowrap" }}>
            {totalVoted}/{onlinePlayers.length}
          </span>
        </div>

        {isRevote && (
          <div style={{ ...S.card, textAlign: "center", border: "1px solid rgba(226,196,74,0.35)", background: "rgba(226,196,74,0.08)" }}>
            <p style={{ fontSize: 14, color: "#E2C44A", fontWeight: 700, margin: 0 }}>Hubo un empate</p>
            <p style={{ fontSize: 13, color: "var(--jt-muted-text)", marginTop: 4 }}>Se vota de nuevo solo entre los más votados</p>
          </div>
        )}

        {offlineAlive.length > 0 && (
          <div style={{ ...S.card, textAlign: "center", border: "1px solid rgba(226,196,74,0.35)", background: "rgba(226,196,74,0.08)" }}>
            <p style={{ fontSize: 14, color: "#E2C44A", fontWeight: 700, margin: 0 }}>
              {offlineAlive.length === 1 ? `${offlineAlive[0].name} se desconectó` : `${offlineAlive.length} jugadores se desconectaron`}
            </p>
            <p style={{ fontSize: 13, color: "var(--jt-muted-text)", marginTop: 4 }}>
              La votación sigue pausada hasta que vuelva{offlineAlive.length === 1 ? "" : "n"} o se lo/a expulse
              {reconnectDeadline != null && (
                <>
                  {" "}
                  — <strong style={{ color: "#E2C44A" }}>{reconnectSecs}s</strong>
                </>
              )}
            </p>
          </div>
        )}

        <CluesReview clues={round?.clues} players={room.players} />

        <div style={S.card}>
          <span style={S.label}>Elegí a quién sospechás</span>
          {!voteConfirmed ? (
            <SuspectGrid
              suspects={suspects.map(p => ({ id: p.id, name: p.name, online: p.online }))}
              selectedId={selectedSuspect}
              onSelect={setSelectedSuspect}
              voteCounts={voteCounts}
            />
          ) : (
            <p style={{ fontSize: 14, color: "#5DCAA5", textAlign: "center", marginTop: 10 }}>
              Ya votaste — esperando a que confirmen los demás.
            </p>
          )}
        </div>

        <StickyActionBar>
          {!voteConfirmed ? (
            <Btn variant="success" disabled={!selectedSuspect} onClick={confirmVote} className="impostor-action-btn" style={successGlow}>
              Confirmar voto
            </Btn>
          ) : (
            <p style={{ ...S.muted, textAlign: "center", margin: 0 }}>
              Votos confirmados: {totalVoted}/{onlinePlayers.length}
            </p>
          )}
        </StickyActionBar>
      </div>
    </PhaseTransition>
  );
}
