import type { CSSProperties } from "react";
import clsx from "clsx";
import { T } from "../../../../theme/styles/classes";
import { StartButton } from "../../../../components/setup/StartButton";
import { StickyActionBar } from "../../../../components/setup/StickyActionBar";
import { PhaseTransition } from "../../../../components/game-kit/PhaseTransition";
import { BigTextFlash } from "../../../../components/game-kit/BigTextFlash";
import { EliminationRevealOverlay, MatchOutcomeOverlay } from "../shared/EliminationRevealOverlay";
import { MatchResultHeader } from "../shared/MatchResultHeader";
import { VotesBreakdownCard } from "../shared/VotesBreakdownCard";
import { actionBtnStyle } from "../shared/actionBtnStyle";
import type { RoundViewProps } from "../../../gameTypes";
import type { ImpostorRoundState, ImpostorHistoryEntry } from "../../types/roundView";

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

  if (revealCount > 0) return <BigTextFlash text="Descubramos quién era..." />;

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
      return <MatchOutcomeOverlay winner={winner} impostorNames={impostors.map(p => p.name)} onContinue={() => setRevealStep("done")} />;
    }
  }

  const eliminatedId = round?.eliminated ?? lastH?.eliminated;
  const glowStyle = { "--impostor-action-glow": "rgba(93,202,165,0.35)" } as CSSProperties;

  return (
    <PhaseTransition phaseKey="result">
      <div className="pb-[88px]">
        <style>{actionBtnStyle}</style>
        {/* The normal win/lose outcome is already shown in MatchOutcomeOverlay
            above — this only needs to cover abortedReason, whose path skips
            that overlay entirely (there's no real elimination to walk
            through when the impostor just left). */}
        {abortedReason === "impostor_disconnected" && (
          <div className="mb-5 text-center">
            <p className="m-0 mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jt-accent,#e0202b)]">
              Partida terminada
            </p>
            <h2 className="m-0 mb-2 text-[22px] font-extrabold tracking-[-0.02em]" style={{ color: winnerColor }}>
              🔌 El impostor se desconectó
            </h2>
            <p className={clsx(T.muted, "text-[13px]")}>
              La partida se cerró sin definir un ganador porque el impostor abandonó.
              {votesDiscarded && " Los votos que ya se habían emitido en esta ronda no se cuentan."}
            </p>
          </div>
        )}

        {!abortedReason && tieBrokenRandomly && (
          <p className="m-0 mb-2 text-center text-xs text-[#E2C44A]">🎲 Empate persistente — se sorteó entre los más votados</p>
        )}

        {!abortedReason && (
          <MatchResultHeader
            matchOver={matchOver}
            eliminatedName={eliminated?.name}
            winner={winner}
            impostorNames={impostors.map(p => p.name)}
            word={matchOver ? String(word ?? "") : undefined}
          />
        )}

        <VotesBreakdownCard
          participants={roundParticipants.map(p => ({ id: p.id, name: p.name }))}
          votes={votes}
          eliminatedId={eliminatedId}
        />

        <StickyActionBar>
          {isHost && matchOver && (
            <StartButton onClick={() => send({ type: "new_game" })} className="impostor-action-btn" style={glowStyle}>
              Nueva partida
            </StartButton>
          )}
          {isHost && !matchOver && (
            <StartButton onClick={() => send({ type: "continue_round" })} className="impostor-action-btn" style={glowStyle}>
              Siguiente ronda
            </StartButton>
          )}
          {!isHost && (
            <div className={clsx(T.card, "mb-0 text-center")}>
              <p className="text-sm text-[var(--jt-muted-text)]">
                {matchOver ? "Esperando que el anfitrión inicie otra partida" : "Esperando que el anfitrión continúe la ronda"}
              </p>
            </div>
          )}
        </StickyActionBar>
      </div>
    </PhaseTransition>
  );
}
