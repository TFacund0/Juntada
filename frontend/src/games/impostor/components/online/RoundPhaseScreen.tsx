import type { CSSProperties } from "react";
import clsx from "clsx";
import { T } from "../../../../theme/styles/classes";
import { Btn } from "../../../../components/ui/Btn";
import { Timer } from "../../../../components/game-kit/Timer";
import { RevealCountdown } from "../../../../components/game-kit/RevealCountdown";
import { PhaseTransition } from "../../../../components/game-kit/PhaseTransition";
import { TurnCircle } from "../../../../components/game-kit/TurnCircle";
import { FlipRevealCard } from "../shared/FlipRevealCard";
import { CluesReview } from "../shared/CluesReview";
import { actionBtnStyle } from "../shared/actionBtnStyle";
import type { RoundViewProps } from "../../../gameTypes";
import type { ImpostorRoundState, ImpostorConfigState } from "../../types/roundView";

interface RoundPhaseScreenProps {
  room: RoundViewProps["room"];
  me: RoundViewProps["me"];
  myRole: RoundViewProps["myRole"];
  send: RoundViewProps["send"];
  round: ImpostorRoundState | null;
  config: ImpostorConfigState;
  wordVisible: boolean;
  setWordVisible: (updater: (prev: boolean) => boolean) => void;
  readyForClues: boolean;
  setReadyForClues: (value: boolean) => void;
  clueText: string;
  setClueText: (value: string) => void;
  clueSubmitted: boolean;
  setClueSubmitted: (value: boolean) => void;
  wordChangeCount: number;
  restartBannerCount: number;
}

// The round phase, split into the same two beats as LocalGame's own
// reveal -> clue-giving split (RevealScreen -> ClueEntryScreen): first your
// own card (tap to reveal, same FlipRevealCard both modes share), then the
// turn-order screen (TurnCircle + words-so-far, also shared) once you tap
// "Empezar pistas". Unlike local's pass-and-play version, moving from one
// screen to the other is purely local pacing — nothing server-side gates
// it, since everyone already has their own device instead of handing one
// around. wordChangeCount/restartBannerCount gate the whole thing behind a
// brief countdown banner right after a skip_word actually swaps the word or
// restarts the match — see RoundView's own effects for why those are
// tracked at that level, not in here.
export function RoundPhaseScreen({
  room,
  me,
  myRole,
  send,
  round,
  config,
  wordVisible,
  setWordVisible,
  readyForClues,
  setReadyForClues,
  clueText,
  setClueText,
  clueSubmitted,
  setClueSubmitted,
  wordChangeCount,
  restartBannerCount,
}: RoundPhaseScreenProps) {
  if (wordChangeCount > 0) return <RevealCountdown count={wordChangeCount} label="Cambiando de palabra..." />;
  if (restartBannerCount > 0) {
    return <RevealCountdown count={restartBannerCount} label="No quedaban más palabras en esa categoría: arrancó una partida nueva" />;
  }

  const turnOrder: string[] = round?.turnOrder || [];
  const turnIndex: number = round?.turnIndex ?? 0;
  const currentTurnId = turnOrder[turnIndex];
  const isMyTurn = !!me?.playerId && currentTurnId === me.playerId;
  const currentTurnPlayer = room.players.find(p => p.id === currentTurnId);
  const requiresWrittenClue = config.writtenClues;

  const submitClue = () => {
    if (requiresWrittenClue && !clueText.trim()) return;
    send({ type: "submit_clue", clue: requiresWrittenClue ? clueText.trim() : "" });
    setClueSubmitted(true);
  };

  if (!readyForClues) {
    return (
      <PhaseTransition phaseKey="round-reveal">
        <div className="flex min-h-[calc(100dvh-140px)] flex-col">
          <style>{actionBtnStyle}</style>
          {round?.timerEnd && <Timer timerEnd={round.timerEnd} total={config.clueTime} label="Tiempo para dar su palabra" />}

          <div className="mb-3.5 text-center">
            <p className="m-0 mb-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jt-accent,#7F77DD)]">Tu turno</p>
            <p className="m-0 text-2xl font-extrabold">Revisá tu carta</p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            {!myRole ? (
              <div className={clsx(T.card, "flex min-h-[200px] items-center justify-center text-center")}>
                <p className="text-[var(--jt-muted-text)]">Cargando tu rol...</p>
              </div>
            ) : (
              <FlipRevealCard
                visible={wordVisible}
                onToggle={() => setWordVisible(v => !v)}
                isImpostor={Boolean(myRole.isImpostor)}
                word={String(myRole.word ?? "")}
                hint={myRole.hint ? String(myRole.hint) : null}
                categoryLabel={round?.categoryLabel ?? ""}
                showCategory={config.showCategory}
                minHeight={220}
              />
            )}
          </div>

          <Btn onClick={() => setReadyForClues(true)} disabled={!myRole} className="impostor-action-btn">
            Empezar pistas
          </Btn>
        </div>
      </PhaseTransition>
    );
  }

  return (
    <PhaseTransition phaseKey={`round-${currentTurnId}`}>
      <div className="flex min-h-[calc(100dvh-140px)] flex-col">
        <style>{actionBtnStyle}</style>
        {round?.timerEnd && <Timer timerEnd={round.timerEnd} total={config.clueTime} label="Tiempo para dar su palabra" />}

        <div className="flex min-h-0 flex-1 flex-col">
          {turnOrder.length > 0 && (
            <p className={clsx(T.muted, "mb-2.5 text-center text-xs")}>
              Turno {turnIndex + 1} de {turnOrder.length}
            </p>
          )}
          <div className="mb-7 text-center">
            <p className="m-0 mb-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--jt-accent,#7F77DD)]">Turno de</p>
            <p className="m-0 text-2xl font-extrabold">{currentTurnPlayer?.name ?? "—"}</p>
          </div>

          <TurnCircle turnOrder={turnOrder} turnIndex={turnIndex} players={room.players} meId={me?.playerId} />

          <CluesReview clues={round?.clues} players={room.players} label="Palabras de los jugadores" maxHeight={140} />
        </div>

        {isMyTurn && !clueSubmitted && requiresWrittenClue && (
          <div className={T.card}>
            <span className={T.label}>Tu palabra</span>
            <input
              className={T.input}
              placeholder="Escribí tu palabra..."
              value={clueText}
              onChange={e => setClueText(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {isMyTurn && !clueSubmitted ? (
          <Btn
            variant="success"
            disabled={requiresWrittenClue && !clueText.trim()}
            onClick={submitClue}
            className="impostor-action-btn"
            style={{ "--impostor-action-glow": "rgba(93,202,165,0.3)" } as CSSProperties}
          >
            {requiresWrittenClue ? "Enviar palabra" : "Ya dije mi palabra"}
          </Btn>
        ) : isMyTurn && clueSubmitted ? (
          <p className="text-center text-sm text-[#5DCAA5]">Palabra enviada — pasando el turno...</p>
        ) : (
          <p className={clsx(T.muted, "text-center")}>{currentTurnPlayer ? `Esperando a ${currentTurnPlayer.name}...` : "Esperando..."}</p>
        )}
      </div>
    </PhaseTransition>
  );
}
