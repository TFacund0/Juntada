import { useMemo } from "react";
import { useAnimationGate } from "../../../../components/game-kit/hooks/useAnimationGate";
import type { RoundViewProps } from "../../../gameTypes";
import type { ChatEntry, PrivateChatView } from "../../types/roundView";
import type { RayadoSfx } from "../../hooks/useRayadoSfx";
import { useChatFeedback } from "../../hooks/useChatFeedback";
import { DRAWER_TIP, EMPTY_CHAT_DRAWER, EMPTY_CHAT_GUESSER, buildChatFeed, drawingNowLine, eligibleGuessers } from "../../utils/chatFeed";
import { MuteButton } from "../MuteButton";
import { ChatHeader } from "./ChatHeader";
import { ChatFeed } from "./ChatFeed";
import { TypingIndicator } from "./TypingIndicator";
import { GuessForm } from "./GuessForm";

interface OnlineAnswersPanelProps {
  players: RoundViewProps["room"]["players"];
  myId: string | undefined;
  drawerId: string;
  drawerName: string;
  isDrawer: boolean;
  chatLog: readonly ChatEntry[];
  correctGuessers: readonly string[];
  roundPoints: Record<string, number>;
  privateChat: PrivateChatView;
  /** Quiénes están escribiendo (ver useTypingIds — lo calcula quien llama para compartirlo con la lista de jugadores). */
  typingIds: readonly string[];
  guess: { value: string; onChange: (text: string) => void; onSubmit: () => void };
  sfx: RayadoSfx;
}

/**
 * Panel "Respuestas" del modo online: cabecera con quién adivinó, historial
 * completo con scroll, "escribiendo…" y el input (quien dibuja lo ve sin
 * input). Arma las líneas desde el log del turno y la vista privada; lo
 * visual vive en los componentes de esta carpeta.
 */
export function OnlineAnswersPanel({
  players,
  myId,
  drawerId,
  drawerName,
  isDrawer,
  chatLog,
  correctGuessers,
  roundPoints,
  privateChat,
  typingIds,
  guess,
  sfx,
}: OnlineAnswersPanelProps) {
  const canAnimate = useAnimationGate();
  const closeShake = useChatFeedback({ chatLog, myId, closeEntryIds: privateChat.closeEntryIds, sfx, canAnimate });
  const alreadyGuessed = !!myId && correctGuessers.includes(myId);

  const items = useMemo(
    () =>
      buildChatFeed({
        chatLog,
        players,
        myId,
        closeEntryIds: privateChat.closeEntryIds,
        roundPoints,
        systemLine: isDrawer ? DRAWER_TIP : drawingNowLine(drawerName),
      }),
    [chatLog, players, myId, privateChat.closeEntryIds, roundPoints, isDrawer, drawerName],
  );
  const guessed = useMemo(
    () =>
      correctGuessers.flatMap(id => {
        const p = players.find(x => x.id === id);
        return p ? [{ id, name: p.name, points: roundPoints[id] ?? 0 }] : [];
      }),
    [correctGuessers, players, roundPoints],
  );
  const typingNames = typingIds.flatMap(id => players.find(p => p.id === id)?.name ?? []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatHeader
        title="Respuestas"
        guessed={guessed}
        eligible={eligibleGuessers(players, drawerId, correctGuessers)}
        canAnimate={canAnimate}
        bubbleSpace
        action={<MuteButton muted={sfx.muted} onToggle={sfx.toggleMuted} />}
      />
      <ChatFeed items={items} emptyText={isDrawer ? EMPTY_CHAT_DRAWER : EMPTY_CHAT_GUESSER} canAnimate={canAnimate} />
      <TypingIndicator names={typingNames} />
      {!isDrawer && (
        <GuessForm
          value={guess.value}
          onChange={guess.onChange}
          onSubmit={guess.onSubmit}
          done={alreadyGuessed}
          doneWord={privateChat.guessedWord}
          closeShake={closeShake}
        />
      )}
    </div>
  );
}
