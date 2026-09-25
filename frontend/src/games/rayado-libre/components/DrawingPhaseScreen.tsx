import { useMemo } from "react";
import { PhaseTransition } from "../../../components/game-kit/PhaseTransition";
import { TURN_SECONDS } from "@juntada/rayado-libre-scoring";
import type { RoundViewProps } from "../../gameTypes";
import type { RayadoLibreRoundState } from "../types/roundView";
import type { RayadoSfx } from "../hooks/useRayadoSfx";
import { roomScore } from "../utils/roomScore";
import { buildPlayerRows } from "../utils/playerRows";
import { letterCount } from "../utils/hintCells";
import { turnSubtitle } from "../utils/turnText";
import { type Tool } from "./Canvas";
import { EyeToggle } from "./EyeToggle";
import { GuessChatPanel } from "./GuessChatPanel";
import { CorrectGuessFlash } from "./CorrectGuessFlash";
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
  sfx: RayadoSfx;
  send: RoundViewProps["send"];
}

/** Fase "drawing": el tablero en vivo, la pista/palabra, los jugadores, quién ya adivinó, y el chat. */
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
  sfx,
  send,
}: DrawingPhaseScreenProps) {
  const strokes = round.strokes ?? [];
  const chatLog = round.chatLog ?? [];
  const correctGuessers = round.correctGuessers ?? [];
  const roundPoints = round.roundPoints ?? {};
  const alreadyGuessed = !!me?.playerId && correctGuessers.includes(me.playerId);
  const canReroll = isDrawer && !round.rerollUsed && correctGuessers.length === 0;
  const hint = round.wordHint ?? "";
  const drawerName = drawerPlayer?.name ?? "";
  // Memoizado: escribir en el chat re-renderiza esta pantalla en cada tecla.
  const players = useMemo(
    () =>
      buildPlayerRows({
        players: room.players,
        scores: roomScore(room),
        drawerId: round.drawerId,
        correctGuessers: round.correctGuessers ?? [],
        roundPoints: round.roundPoints ?? {},
      }),
    [room, round],
  );

  const submitGuess = () => {
    if (!guessText.trim()) return;
    send({ type: "guess", text: guessText.trim() });
    setGuessText("");
  };

  // Quien dibuja ve su palabra entera (subrayado verde) y puede taparla con
  // el ojo. El <p> oculto es el texto accesible de la palabra (las letras
  // sueltas de la pista son decorativas) y lo que lee el e2e; su
  // `visibility` va inline porque es lo que verifican los tests.
  const word =
    isDrawer && myWord ? (
      <div className="rl-board-word flex items-center gap-2 @min-[1000px]:justify-center">
        <p className="sr-only" style={{ visibility: wordVisible ? "visible" : "hidden" }}>
          {myWord}
        </p>
        <div className={wordVisible ? undefined : "invisible"}>
          <HintText hint={myWord} full showCount />
        </div>
        <EyeToggle visible={wordVisible} onClick={() => setWordVisible(v => !v)} />
      </div>
    ) : (
      <HintText hint={hint} onReveal={() => sfx.play("card")} />
    );

  return (
    <PhaseTransition phaseKey="drawing">
      {pointsToast != null && <CorrectGuessFlash points={pointsToast} />}
      <DrawingBoard
        canvas={{
          strokes,
          tool,
          onToolChange: setTool,
          onStrokeChunk: (points, color, size, strokeId) => send({ type: "draw_stroke", points, color, size, strokeId }),
          onFillAt: (x, y, color) => send({ type: "draw_fill", x, y, color }),
          onClear: () => send({ type: "draw_clear" }),
          onUndo: () => send({ type: "draw_undo" }),
          // Pedir otra palabra vacía la hoja en el motor: eso no es un "borrar todo".
          resetKey: `${round.turnNumber}:${!!round.rerollUsed}`,
        }}
        interactive={isDrawer}
        timerEnd={round.timerEnd}
        total={TURN_SECONDS}
        correctCount={correctGuessers.length}
        header={{
          drawerName,
          subtitle: turnSubtitle({ isDrawer, drawerName, letters: letterCount(isDrawer ? (myWord ?? "") : hint) }),
          word,
          wordKey: isDrawer ? myWord : undefined,
          notice: drawerOffline && (
            <p className="mt-1 text-xs text-rl-warn">
              ⚠️ {drawerName} se desconectó — el turno sigue corriendo hasta que se acabe el tiempo
            </p>
          ),
        }}
        players={players}
        sfx={sfx}
        idleText={myWord && wordVisible ? `Dibujá ${myWord.toUpperCase()} acá` : null}
        remotePen
        onReroll={canReroll ? () => send({ type: "reroll_word" }) : undefined}
        sideLabel="Chat de respuestas"
        sideContent={
          <div className="min-h-0 flex-1 overflow-y-auto">
            <GuessChatPanel
              bare
              chatLog={chatLog}
              players={room.players}
              correctGuessers={correctGuessers}
              roundPoints={roundPoints}
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
          </div>
        }
      />
    </PhaseTransition>
  );
}
