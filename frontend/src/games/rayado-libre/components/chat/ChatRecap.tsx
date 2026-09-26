import { useMemo } from "react";
import type { RoundViewProps } from "../../../gameTypes";
import type { ChatEntry } from "../../types/roundView";
import { buildChatFeed, eligibleGuessers } from "../../utils/chatFeed";
import { ChatHeader } from "./ChatHeader";
import { ChatLine } from "./ChatLine";

interface ChatRecapProps {
  players: RoundViewProps["room"]["players"];
  myId: string | undefined;
  drawerId: string;
  chatLog: readonly ChatEntry[];
  correctGuessers: readonly string[];
  roundPoints: Record<string, number>;
  closeEntryIds: readonly number[];
}

const NEVER = () => false;

/** El chat del turno, completo y de solo lectura, en la pantalla de revelación — mismas líneas que en vivo, sin animaciones. */
export function ChatRecap({ players, myId, drawerId, chatLog, correctGuessers, roundPoints, closeEntryIds }: ChatRecapProps) {
  const items = useMemo(
    () => buildChatFeed({ chatLog, players, myId, closeEntryIds, roundPoints }),
    [chatLog, players, myId, closeEntryIds, roundPoints],
  );
  const guessed = correctGuessers.flatMap(id => {
    const p = players.find(x => x.id === id);
    return p ? [{ id, name: p.name, points: roundPoints[id] ?? 0 }] : [];
  });

  return (
    <section
      aria-label="Respuestas del turno"
      className="overflow-hidden rounded-[18px] border border-rl-card-border bg-rl-surface font-figtree text-rl-ink"
    >
      <ChatHeader title="Respuestas" guessed={guessed} eligible={eligibleGuessers(players, drawerId, correctGuessers)} canAnimate={NEVER} />
      <div className="flex max-h-[50dvh] flex-col gap-1.5 overflow-y-auto overscroll-contain px-3 pb-2 pt-2.5">
        {items.length === 0 ? (
          <p className="m-0 py-2 text-center text-[13px] text-rl-muted">Nadie escribió nada en este turno.</p>
        ) : (
          items.map(item => <ChatLine key={item.key} item={item} />)
        )}
      </div>
    </section>
  );
}
