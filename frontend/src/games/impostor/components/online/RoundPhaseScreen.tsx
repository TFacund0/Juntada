import type { CSSProperties } from "react";
import { S } from "../../../../theme/styles";
import { Btn } from "../../../../components/Btn";
import { Timer } from "../../../../components/Timer";
import { RevealCountdown } from "../../../../components/RevealCountdown";
import { PhaseTransition } from "../../../../components/PhaseTransition";
import { TurnCircle } from "../../../../components/TurnCircle";
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
        <div style={{ minHeight: "calc(100dvh - 140px)", display: "flex", flexDirection: "column" }}>
          <style>{actionBtnStyle}</style>
          {round?.timerEnd && <Timer timerEnd={round.timerEnd} total={config.clueTime} label="Tiempo para dar su palabra" />}

          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <p
              style={{
                margin: "0 0 4px",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--jt-accent, #7F77DD)",
              }}
            >
              Tu turno
            </p>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 24 }}>Revisá tu carta</p>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            {!myRole ? (
              <div
                style={{
                  ...S.card,
                  textAlign: "center",
                  minHeight: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <p style={{ color: "var(--jt-muted-text)" }}>Cargando tu rol...</p>
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
      <div style={{ minHeight: "calc(100dvh - 140px)", display: "flex", flexDirection: "column" }}>
        <style>{actionBtnStyle}</style>
        {round?.timerEnd && <Timer timerEnd={round.timerEnd} total={config.clueTime} label="Tiempo para dar su palabra" />}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {turnOrder.length > 0 && (
            <p style={{ ...S.muted, textAlign: "center", marginBottom: 10, fontSize: 12 }}>
              Turno {turnIndex + 1} de {turnOrder.length}
            </p>
          )}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <p
              style={{
                margin: "0 0 4px",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--jt-accent, #7F77DD)",
              }}
            >
              Turno de
            </p>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 24 }}>{currentTurnPlayer?.name ?? "—"}</p>
          </div>

          <TurnCircle turnOrder={turnOrder} turnIndex={turnIndex} players={room.players} meId={me?.playerId} />

          <CluesReview clues={round?.clues} players={room.players} label="Palabras de los jugadores" maxHeight={140} />
        </div>

        {isMyTurn && !clueSubmitted && requiresWrittenClue && (
          <div style={S.card}>
            <span style={S.label}>Tu palabra</span>
            <input
              style={S.input}
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
          <p style={{ color: "#5DCAA5", fontSize: 14, textAlign: "center" }}>Palabra enviada — pasando el turno...</p>
        ) : (
          <p style={{ ...S.muted, textAlign: "center" }}>
            {currentTurnPlayer ? `Esperando a ${currentTurnPlayer.name}...` : "Esperando..."}
          </p>
        )}
      </div>
    </PhaseTransition>
  );
}
