import { S } from "../../../theme/styles";
import { Btn } from "../../../components/Btn";
import { Timer } from "../../../components/Timer";
import { PhaseTransition } from "../../../components/PhaseTransition";
import { TURN_SECONDS } from "@juntada/rayado-libre-scoring";
import type { RoundViewProps } from "../../gameTypes";
import type { RayadoLibreRoundState } from "../types/roundView";
import { Canvas, type Tool } from "./Canvas";
import { Toolbar } from "./Toolbar";
import { EyeToggle } from "./EyeToggle";
import { WordHintCard } from "./WordHintCard";
import { GuessersStatus } from "./GuessersStatus";
import { ChatMessages } from "./ChatMessages";

interface DrawingPhaseScreenProps {
  room: RoundViewProps["room"];
  round: RayadoLibreRoundState;
  me: RoundViewProps["me"];
  isDrawer: boolean;
  myWord: string | undefined;
  drawerPlayer: RoundViewProps["room"]["players"][number] | undefined;
  drawerOffline: boolean;
  tool: Tool;
  setTool: (tool: Tool) => void;
  guessText: string;
  setGuessText: (text: string) => void;
  pointsToast: number | null;
  wordVisible: boolean;
  setWordVisible: (visible: boolean | ((v: boolean) => boolean)) => void;
  send: RoundViewProps["send"];
}

/** Fase "drawing": el tablero en vivo, la pista/palabra, quién ya adivinó, y el chat. */
export function DrawingPhaseScreen({
  room,
  round,
  me,
  isDrawer,
  myWord,
  drawerPlayer,
  drawerOffline,
  tool,
  setTool,
  guessText,
  setGuessText,
  pointsToast,
  wordVisible,
  setWordVisible,
  send,
}: DrawingPhaseScreenProps) {
  const strokes = round.strokes ?? [];
  const chatLog = round.chatLog ?? [];
  const correctGuessers = round.correctGuessers ?? [];
  const alreadyGuessed = !!me?.playerId && correctGuessers.includes(me.playerId);

  const submitGuess = () => {
    if (!guessText.trim()) return;
    send({ type: "guess", text: guessText.trim() });
    setGuessText("");
  };

  return (
    <PhaseTransition phaseKey="drawing">
      <p style={{ textAlign: "center", fontSize: 13, color: "#9089c0", marginBottom: 4 }}>
        Turno {round.turnNumber}/{round.totalTurns} — dibuja {drawerPlayer?.name}
      </p>
      {round.timerEnd && <Timer timerEnd={round.timerEnd} total={TURN_SECONDS} label="Tiempo para dibujar" />}
      {drawerOffline && (
        <p style={{ fontSize: 12, color: "#E2C44A", textAlign: "center", marginBottom: 8 }}>
          ⚠️ {drawerPlayer?.name} se desconectó — el turno sigue corriendo hasta que se acabe el tiempo
        </p>
      )}

      {pointsToast != null && (
        <div style={{ ...S.cardHighlight, textAlign: "center", background: "rgba(93,202,165,0.15)" }}>
          <p style={{ fontWeight: 800, color: "#5DCAA5", margin: 0 }}>¡Adivinaste! +{pointsToast} puntos</p>
        </div>
      )}

      {isDrawer && myWord && (
        <div style={{ ...S.cardHighlight, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <p style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "#AFA9EC", visibility: wordVisible ? "visible" : "hidden" }}>
            {myWord}
          </p>
          <EyeToggle visible={wordVisible} onClick={() => setWordVisible(v => !v)} />
        </div>
      )}

      {!isDrawer && round.wordHint && <WordHintCard hint={round.wordHint} />}

      <GuessersStatus
        players={room.players}
        drawerId={round.drawerId}
        correctGuessers={correctGuessers}
        roundPoints={round.roundPoints ?? {}}
      />

      <Canvas
        strokes={strokes}
        interactive={isDrawer}
        tool={isDrawer ? tool : undefined}
        onStrokeChunk={(points, color, size, strokeId) => send({ type: "draw_stroke", points, color, size, strokeId })}
        onFillAt={(x, y, color) => send({ type: "draw_fill", x, y, color })}
      />
      {isDrawer && (
        <Toolbar tool={tool} onChange={setTool} onClear={() => send({ type: "draw_clear" })} onUndo={() => send({ type: "draw_undo" })} />
      )}

      <div style={{ ...S.card, marginTop: 16 }}>
        <span style={S.label}>{isDrawer ? "Chat — lo que van escribiendo" : "Chat — escribí tu respuesta"}</span>
        {/* Only the last 5 while live — the full recent history (up to
            CHAT_LOG_LIMIT server-side) shows in the reveal-phase recap
            instead, so a busy turn's older guesses aren't lost entirely. */}
        <ChatMessages chatLog={chatLog.slice(-5)} players={room.players} />
        {!isDrawer &&
          (alreadyGuessed ? (
            <p style={{ ...S.muted, textAlign: "center" }}>Ya adivinaste esta ronda — esperá a que termine el turno.</p>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{ ...S.input, flex: 1 }}
                placeholder="Tu respuesta..."
                value={guessText}
                onChange={e => setGuessText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") submitGuess();
                }}
              />
              <Btn onClick={submitGuess} style={{ width: "auto", padding: "11px 18px" }}>
                Enviar
              </Btn>
            </div>
          ))}
      </div>
    </PhaseTransition>
  );
}
