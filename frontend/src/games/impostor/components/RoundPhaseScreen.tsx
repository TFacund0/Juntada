import { S } from "../../../theme/styles";
import { Btn } from "../../../components/Btn";
import { Timer } from "../../../components/Timer";
import { RevealCountdown } from "../../../components/RevealCountdown";
import { PhaseTransition } from "../../../components/PhaseTransition";
import { TurnCircle } from "../../../components/TurnCircle";
import { CluesReview } from "./CluesReview";
import type { RoundViewProps } from "../../gameTypes";
import type { ImpostorRoundState, ImpostorConfigState } from "../types/roundView";

interface RoundPhaseScreenProps {
  room: RoundViewProps["room"];
  me: RoundViewProps["me"];
  myRole: RoundViewProps["myRole"];
  send: RoundViewProps["send"];
  round: ImpostorRoundState | null;
  config: ImpostorConfigState;
  wordVisible: boolean;
  setWordVisible: (updater: (prev: boolean) => boolean) => void;
  clueText: string;
  setClueText: (value: string) => void;
  clueSubmitted: boolean;
  setClueSubmitted: (value: boolean) => void;
  wordChangeCount: number;
  restartBannerCount: number;
}

// The turn-based clue-giving phase: reveal your own word/role, then wait for
// (or take) your turn in the shared turn order. wordChangeCount/
// restartBannerCount gate this behind a brief countdown banner right after a
// skip_word actually swaps the word or restarts the match — see RoundView's
// own effects for why those are tracked at that level, not in here.
export function RoundPhaseScreen({
  room,
  me,
  myRole,
  send,
  round,
  config,
  wordVisible,
  setWordVisible,
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

  return (
    <PhaseTransition phaseKey={`round-${currentTurnId}`}>
      <div>
        {round?.timerEnd && <Timer timerEnd={round.timerEnd} total={config.clueTime} label="Tiempo para dar su palabra" />}

        <div
          style={{
            ...S.card,
            textAlign: "center",
            cursor: "pointer",
            minHeight: 140,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setWordVisible(v => !v)}
        >
          {!myRole ? (
            <p style={{ color: "var(--jt-muted-text)" }}>Cargando tu rol...</p>
          ) : !wordVisible ? (
            <p style={{ color: "var(--jt-muted-text)", fontSize: 14 }}>Tocá para ver tu palabra</p>
          ) : (
            <>
              {config.showCategory && round?.categoryLabel && (
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#FF3B3B",
                    margin: "0 0 8px",
                  }}
                >
                  {round.categoryLabel}
                </p>
              )}
              {myRole.isImpostor ? (
                <>
                  <p style={{ fontSize: 20, fontWeight: 800, color: "#F09595", margin: "0 0 8px" }}>Sos el impostor</p>
                  {myRole.hint ? <p style={{ fontSize: 13, color: "var(--jt-muted-text)" }}>{String(myRole.hint)}</p> : null}
                </>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: "var(--jt-muted-text)", marginBottom: 4 }}>Tu palabra secreta</p>
                  <p style={S.bigReveal}>{String(myRole.word)}</p>
                </>
              )}
              <p style={{ fontSize: 12, color: "var(--jt-muted-text)", marginTop: 8 }}>Tocá para ocultar</p>
            </>
          )}
        </div>

        <CluesReview clues={round?.clues} players={room.players} />

        <div style={S.card}>
          <span style={S.label}>Ronda de turnos</span>
          {turnOrder.length > 0 && (
            <p style={{ ...S.muted, textAlign: "center", marginBottom: 8 }}>
              Turno {turnIndex + 1}/{turnOrder.length}
            </p>
          )}
          <TurnCircle turnOrder={turnOrder} turnIndex={turnIndex} players={room.players} meId={me?.playerId} />

          {isMyTurn && !clueSubmitted ? (
            requiresWrittenClue ? (
              <>
                <span style={S.label}>Tu palabra</span>
                <input style={S.input} placeholder="Escribí tu palabra..." value={clueText} onChange={e => setClueText(e.target.value)} />
                <Btn variant="success" disabled={!clueText.trim()} onClick={submitClue} style={{ marginTop: 8 }}>
                  Enviar palabra
                </Btn>
              </>
            ) : (
              <>
                <p style={{ ...S.muted, textAlign: "center", marginBottom: 10 }}>Es tu turno — decí tu palabra en voz alta y confirmá.</p>
                <Btn variant="success" onClick={submitClue}>
                  Ya dije mi palabra
                </Btn>
              </>
            )
          ) : isMyTurn && clueSubmitted ? (
            <p style={{ color: "#5DCAA5", fontSize: 14, textAlign: "center" }}>Palabra enviada — pasando el turno...</p>
          ) : (
            <p style={{ ...S.muted, textAlign: "center" }}>
              {currentTurnPlayer ? `Esperando a ${currentTurnPlayer.name}...` : "Esperando..."}
            </p>
          )}
        </div>
      </div>
    </PhaseTransition>
  );
}
