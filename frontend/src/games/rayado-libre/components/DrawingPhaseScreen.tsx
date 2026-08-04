import { PhaseTransition } from "../../../components/game-kit/PhaseTransition";
import { GameScreenLayout } from "../../../components/game-kit/GameScreenLayout";
import { TURN_SECONDS } from "@juntada/rayado-libre-scoring";
import type { RoundViewProps } from "../../gameTypes";
import type { RayadoLibreRoundState } from "../types/roundView";
import { type Tool } from "./Canvas";
import { EyeToggle } from "./EyeToggle";
import { GuessChatPanel } from "./GuessChatPanel";
import { CorrectGuessFlash } from "./CorrectGuessFlash";
import { TurnHeader } from "./TurnHeader";
import { DrawingBoard } from "./DrawingBoard";
import { HintText } from "./HintText";

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
  const canReroll = isDrawer && !round.rerollUsed && correctGuessers.length === 0;

  const submitGuess = () => {
    if (!guessText.trim()) return;
    send({ type: "guess", text: guessText.trim() });
    setGuessText("");
  };

  const wordOrHint =
    isDrawer && myWord ? (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <p style={{ fontSize: 17, fontWeight: 800, margin: 0, color: "#AFA9EC", visibility: wordVisible ? "visible" : "hidden" }}>
          {myWord}
        </p>
        <EyeToggle visible={wordVisible} onClick={() => setWordVisible(v => !v)} />
      </div>
    ) : !isDrawer && round.wordHint ? (
      <HintText hint={round.wordHint} />
    ) : null;

  return (
    <PhaseTransition phaseKey="drawing">
      <GameScreenLayout
        top={
          <>
            <TurnHeader turnNumber={round.turnNumber} totalTurns={round.totalTurns} drawerName={drawerPlayer?.name} />
            {drawerOffline && (
              <p style={{ fontSize: 12, color: "#E2C44A", textAlign: "center", marginBottom: 8 }}>
                ⚠️ {drawerPlayer?.name} se desconectó — el turno sigue corriendo hasta que se acabe el tiempo
              </p>
            )}
            {pointsToast != null && <CorrectGuessFlash points={pointsToast} />}
          </>
        }
        center={
          <DrawingBoard
            canvas={{
              strokes,
              tool,
              onToolChange: setTool,
              onStrokeChunk: (points, color, size, strokeId) => send({ type: "draw_stroke", points, color, size, strokeId }),
              onFillAt: (x, y, color) => send({ type: "draw_fill", x, y, color }),
              onClear: () => send({ type: "draw_clear" }),
              onUndo: () => send({ type: "draw_undo" }),
            }}
            interactive={isDrawer}
            timerEnd={round.timerEnd}
            total={TURN_SECONDS}
            wordSlot={wordOrHint}
            onReroll={canReroll ? () => send({ type: "reroll_word" }) : undefined}
            sideContent={
              <GuessChatPanel
                chatLog={chatLog}
                players={room.players}
                correctGuessers={correctGuessers}
                roundPoints={round.roundPoints ?? {}}
                variant="live"
                input={
                  isDrawer
                    ? undefined
                    : alreadyGuessed
                      ? {
                          value: guessText,
                          onChange: setGuessText,
                          onSubmit: submitGuess,
                          disabledReason: "Ya adivinaste esta ronda — esperá a que termine el turno.",
                        }
                      : { value: guessText, onChange: setGuessText, onSubmit: submitGuess }
                }
              />
            }
          />
        }
      />
    </PhaseTransition>
  );
}
