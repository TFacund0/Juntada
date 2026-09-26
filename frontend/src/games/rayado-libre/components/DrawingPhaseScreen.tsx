import { useCallback, useMemo, useRef } from "react";
import clsx from "clsx";
import { TURN_SECONDS } from "@juntada/rayado-libre-scoring";
import type { RoundViewProps } from "../../gameTypes";
import type { PrivateChatView, RayadoLibreRoundState } from "../types/roundView";
import { useTypingIds } from "../hooks/useTypingIds";
import { useTypingSignal } from "../hooks/useTypingSignal";
import { useLiftRoomChatBubble } from "../hooks/useLiftRoomChatBubble";
import { useOnlineGuessFx } from "../hooks/useOnlineGuessFx";
import { roomScore } from "../utils/roomScore";
import { buildPlayerRows } from "../utils/playerRows";
import { letterCount } from "../utils/hintCells";
import { turnSubtitle } from "../utils/turnText";
import { type Tool } from "./Canvas";
import { EyeToggle } from "./EyeToggle";
import { OnlineAnswersPanel } from "./chat/OnlineAnswersPanel";
import { DrawingBoard } from "./DrawingBoard";
import { HintText } from "./HintText";
import { useRayadoSfxContext } from "../hooks/rayadoSfxContext";

interface DrawingPhaseScreenProps {
  room: RoundViewProps["room"];
  round: RayadoLibreRoundState;
  me: RoundViewProps["me"];
  isDrawer: boolean;
  myWord: string | undefined;
  privateChat: PrivateChatView;
  drawerPlayer: RoundViewProps["room"]["players"][number] | undefined;
  drawerOffline: boolean;
  tool: Tool;
  setTool: (tool: Tool) => void;
  guessText: string;
  setGuessText: (text: string) => void;
  wordVisible: boolean;
  setWordVisible: (visible: boolean | ((v: boolean) => boolean)) => void;
  send: RoundViewProps["send"];
}

/** Fase "drawing": el tablero en vivo, la pista/palabra, los jugadores, quién ya adivinó, y el chat. */
export function DrawingPhaseScreen({
  room,
  round,
  me,
  isDrawer,
  myWord,
  privateChat,
  drawerPlayer,
  drawerOffline,
  tool,
  setTool,
  guessText,
  setGuessText,
  wordVisible,
  setWordVisible,
  send,
}: DrawingPhaseScreenProps) {
  const sfx = useRayadoSfxContext();
  const strokes = round.strokes ?? [];
  const chatLog = round.chatLog ?? [];
  const correctGuessers = round.correctGuessers ?? [];
  const roundPoints = round.roundPoints ?? {};
  const alreadyGuessed = !!me?.playerId && correctGuessers.includes(me.playerId);
  const hint = round.wordHint ?? "";
  const drawerName = drawerPlayer?.name ?? "";
  const myId = me?.playerId;
  const rootRef = useRef<HTMLDivElement>(null);
  useLiftRoomChatBubble(rootRef);
  useOnlineGuessFx({ rootRef, chatLog, players: room.players, roundPoints, myId, isDrawer, sfx });
  const typingIds = useTypingIds(round.typingUntil, myId);
  const sendTyping = useCallback(() => send({ type: "typing" }), [send]);
  const typing = useTypingSignal(!isDrawer && !alreadyGuessed, sendTyping);
  // Memoizado: escribir en el chat re-renderiza esta pantalla en cada tecla.
  const players = useMemo(
    () =>
      buildPlayerRows({
        players: room.players,
        scores: roomScore(room),
        drawerId: round.drawerId,
        correctGuessers: round.correctGuessers ?? [],
        roundPoints: round.roundPoints ?? {},
        typingIds,
      }),
    [room, round, typingIds],
  );

  const submitGuess = () => {
    if (!guessText.trim() || alreadyGuessed) return;
    send({ type: "guess", text: guessText.trim() });
    setGuessText("");
    typing.reset();
  };

  // Quien dibuja ve su palabra entera (subrayado verde) y puede taparla con
  // el ojo. El <p> oculto es el texto accesible de la palabra (las letras
  // sueltas de la pista son decorativas) y lo que lee el e2e; al taparla
  // también se oculta para lectores de pantalla (`invisible`).
  const word =
    isDrawer && myWord ? (
      <div className="rl-board-word flex items-center gap-2 @min-[1000px]:justify-center">
        <p className={clsx("sr-only", !wordVisible && "invisible")}>{myWord}</p>
        <div className={wordVisible ? undefined : "invisible"}>
          <HintText hint={myWord} full showCount />
        </div>
        <EyeToggle visible={wordVisible} onClick={() => setWordVisible(v => !v)} />
      </div>
    ) : privateChat.guessedWord ? (
      // Ya la adiviné: la pista se completa, con subrayado verde.
      <HintText hint={privateChat.guessedWord} full />
    ) : (
      <HintText hint={hint} onReveal={() => sfx.play("card")} />
    );

  return (
    <div ref={rootRef}>
      <DrawingBoard
        canvas={{
          strokes,
          tool,
          onToolChange: setTool,
          onStrokeChunk: (points, color, size, strokeId) => send({ type: "draw_stroke", points, color, size, strokeId }),
          onFillAt: (x, y, color) => send({ type: "draw_fill", x, y, color }),
          onClear: () => send({ type: "draw_clear" }),
          onUndo: () => send({ type: "draw_undo" }),
          // El cambio de turno vacía la hoja: eso no es un "borrar todo".
          resetKey: String(round.turnNumber),
        }}
        interactive={isDrawer}
        timerEnd={round.timerEnd}
        total={TURN_SECONDS}
        correctCount={correctGuessers.length}
        header={{
          drawerName,
          subtitle: turnSubtitle({ isDrawer, drawerName, letters: letterCount(isDrawer ? (myWord ?? "") : hint) }),
          word,
          notice: drawerOffline && (
            <p className="mt-1 text-xs text-rl-warn">
              ⚠️ {drawerName} se desconectó — el turno sigue corriendo hasta que se acabe el tiempo
            </p>
          ),
        }}
        players={players}
        idleText={myWord && wordVisible ? `Dibujá ${myWord.toUpperCase()} acá` : null}
        remotePen
        sideLabel="Chat de respuestas"
        sideContent={
          <OnlineAnswersPanel
            players={room.players}
            myId={myId}
            drawerId={round.drawerId}
            drawerName={drawerName}
            isDrawer={isDrawer}
            chatLog={chatLog}
            correctGuessers={correctGuessers}
            roundPoints={roundPoints}
            privateChat={privateChat}
            typingIds={typingIds}
            guess={{
              value: guessText,
              onChange: text => {
                setGuessText(text);
                typing.onInput(text);
              },
              onSubmit: submitGuess,
            }}
          />
        }
      />
    </div>
  );
}
