import { S } from "../../../theme/styles";
import { StartButton } from "../../../components/StartButton";
import { RevealCountdown } from "../../../components/RevealCountdown";
import { PhaseTransition } from "../../../components/PhaseTransition";
import { EliminationRevealOverlay, MatchOutcomeOverlay } from "./EliminationRevealOverlay";
import type { RoundViewProps } from "../../gameTypes";
import type { ImpostorRoundState, ImpostorHistoryEntry } from "../types/roundView";

interface ResultPhaseScreenProps {
  room: RoundViewProps["room"];
  wordReveal: RoundViewProps["wordReveal"];
  isHost: boolean;
  send: RoundViewProps["send"];
  round: ImpostorRoundState | null;
  revealCount: number;
  revealStep: "elimination" | "outcome" | "done";
  setRevealStep: (step: "elimination" | "outcome" | "done") => void;
}

// The result phase: a brief countdown, then two sequential reveal overlays
// (who got eliminated, then — only once the match is over — who won/the
// word), then the vote breakdown and next-match controls. Falls back to
// room.roundHistory's last entry once `round` itself is gone (a fresh round
// may have already started server-side by the time this renders).
export function ResultPhaseScreen({
  room,
  wordReveal,
  isHost,
  send,
  round,
  revealCount,
  revealStep,
  setRevealStep,
}: ResultPhaseScreenProps) {
  const lastH = room.roundHistory?.[room.roundHistory.length - 1] as ImpostorHistoryEntry | undefined;
  const word = wordReveal?.word || lastH?.word;
  const eliminated = room.players.find(p => p.id === (round?.eliminated ?? lastH?.eliminated));
  const wasImpostor: boolean | undefined = round?.wasImpostor ?? lastH?.wasImpostor;
  const matchOver: boolean = round?.matchOver ?? lastH?.matchOver ?? false;
  const winner: "innocents" | "impostors" | null = round?.winner ?? lastH?.winner ?? null;
  const abortedReason: string | undefined = round?.abortedReason ?? lastH?.abortedReason;
  const votesDiscarded: boolean | undefined = round?.votesDiscarded ?? lastH?.votesDiscarded;
  const tieBrokenRandomly: boolean | undefined = round?.tieBrokenRandomly ?? lastH?.tieBrokenRandomly;
  const impostors = matchOver ? room.players.filter(p => (round?.impostors || lastH?.impostors || []).includes(p.id)) : [];
  // Who was actually eligible to vote/be voted this round — a stand-in for
  // "everyone still alive at the time", to keep the vote breakdown from
  // dragging in players eliminated in earlier rounds.
  const turnOrder: string[] | undefined = round?.turnOrder;
  const roundParticipants = turnOrder ? room.players.filter(p => turnOrder.includes(p.id)) : room.players;
  const votes: Record<string, string> = round?.votes || {};

  if (revealCount > 0) return <RevealCountdown count={revealCount} label="Revelando resultado..." />;

  const winnerColor = abortedReason ? "#E2C44A" : winner === "innocents" ? "#5DCAA5" : "#F09595";

  // Two sequential overlays before the vote breakdown/next-match controls
  // become reachable — same idea as LocalGame's own reveal flow. Skipped for
  // the (rare) abortedReason case, which has no real elimination to walk
  // through and keeps its own inline banner below.
  if (!abortedReason && eliminated) {
    if (revealStep === "elimination") {
      return (
        <EliminationRevealOverlay
          name={eliminated.name}
          wasImpostor={wasImpostor}
          onContinue={() => setRevealStep(matchOver ? "outcome" : "done")}
        />
      );
    }
    if (revealStep === "outcome" && matchOver) {
      return (
        <MatchOutcomeOverlay
          winner={winner}
          impostorNames={impostors.map(p => p.name)}
          word={String(word ?? "")}
          onContinue={() => setRevealStep("done")}
        />
      );
    }
  }

  return (
    <PhaseTransition phaseKey="result">
      <div>
        {/* The normal win/lose outcome is already shown in MatchOutcomeOverlay
            above — this only needs to cover abortedReason, whose path skips
            that overlay entirely (there's no real elimination to walk
            through when the impostor just left). */}
        {abortedReason === "impostor_disconnected" && (
          <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: winnerColor, marginTop: 8 }}>🔌 El impostor se desconectó</p>
            <p style={{ fontSize: 13, color: "var(--jt-muted-text)", marginTop: 4 }}>
              La partida se cerró sin definir un ganador porque el impostor abandonó.
              {votesDiscarded && " Los votos que ya se habían emitido en esta ronda no se cuentan."}
            </p>
          </div>
        )}

        {!abortedReason && tieBrokenRandomly && (
          <p style={{ fontSize: 12, color: "#E2C44A", textAlign: "center", margin: "0 0 8px" }}>
            🎲 Empate persistente — se sorteó entre los más votados
          </p>
        )}

        <div style={S.card}>
          <span style={S.label}>Votos</span>
          {roundParticipants.map(p => {
            const count = Object.values(votes).filter(v => v === p.id).length;
            const total = Math.max(1, roundParticipants.length - 1);
            const voterNames = roundParticipants.filter(v => votes[v.id] === p.id).map(v => v.name);
            return (
              <div key={p.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{p.name}</span>
                  <span style={S.muted}>{count} votos</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 3,
                      width: `${Math.round((count / total) * 100)}%`,
                      background: p.id === (round?.eliminated ?? lastH?.eliminated) ? "#E24B4A" : "#5a2226",
                      transition: "width 0.6s",
                    }}
                  />
                </div>
                {voterNames.length > 0 && <p style={{ ...S.muted, marginTop: 4, fontSize: 12 }}>Votado por: {voterNames.join(", ")}</p>}
              </div>
            );
          })}
        </div>

        {isHost && matchOver && <StartButton onClick={() => send({ type: "new_game" })}>Nueva partida</StartButton>}
        {isHost && !matchOver && <StartButton onClick={() => send({ type: "continue_round" })}>Siguiente ronda</StartButton>}
        {!isHost && (
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ color: "var(--jt-muted-text)", fontSize: 14 }}>
              {matchOver ? "Esperando que el anfitrión inicie otra partida" : "Esperando que el anfitrión continúe la ronda"}
            </p>
          </div>
        )}
      </div>
    </PhaseTransition>
  );
}
