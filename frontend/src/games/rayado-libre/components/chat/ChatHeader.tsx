import type { ReactNode } from "react";
import clsx from "clsx";
import { Avatar } from "../../../../components/ui/Avatar";
import { useFreshKeys } from "../../hooks/useFreshKeys";

export interface GuessedChip {
  id: string;
  name: string;
  points: number;
}

interface ChatHeaderProps {
  title: string;
  /** Quiénes ya adivinaron, en orden de acierto. */
  guessed: readonly GuessedChip[];
  /** Cuántos pueden adivinar este turno (ver eligibleGuessers). */
  eligible: number;
  canAnimate: () => boolean;
  /**
   * Deja lugar a la derecha para la burbuja del chat de la sala, que en
   * celular se sienta en esta fila (ver useLiftRoomChatBubble) — solo
   * online, en local no hay burbuja.
   */
  bubbleSpace?: boolean;
  /** Al final de la fila, después del contador: el botón de silencio (ver MuteButton). */
  action?: ReactNode;
}

/**
 * Cabecera de la columna del chat: título y, a la derecha, una fichita
 * verde por cada uno que adivinó (avatar + "+N", entra con rebote), el
 * contador "2/3 ✓" y `action` (el silencio). En celular la burbuja del chat
 * de la sala se sienta a la derecha de todo eso (`bubbleSpace`). Es un `<header>` y no un div: el panel local de "¿Quién
 * acertó?" depende de que el div más cercano al título sea el panel entero.
 */
export function ChatHeader({ title, guessed, eligible, canAnimate, bubbleSpace = false, action }: ChatHeaderProps) {
  const isFresh = useFreshKeys(
    guessed.map(g => g.id),
    canAnimate,
  );
  return (
    <header
      data-rl-chat-head
      className={clsx(
        "flex min-h-[46px] flex-none items-center gap-2 border-b border-rl-card-border px-3 pb-2 pt-2.5",
        bubbleSpace && "@max-[700px]:pr-[50px]",
      )}
    >
      <span className="text-xs font-extrabold uppercase tracking-[.06em] text-rl-muted">{title}</span>
      <span className="flex-1" />
      <span className="flex min-w-0 flex-wrap items-center justify-end gap-1">
        {guessed.map(g => (
          <span
            key={g.id}
            title={g.name}
            className={clsx(
              "flex items-center gap-1 rounded-full border border-rl-ok-line bg-rl-ok-soft py-0.5 pl-0.5 pr-2 text-xs font-extrabold text-rl-ok-text",
              isFresh(g.id) && "animate-rl-chip-pop motion-reduce:animate-none",
            )}
          >
            <Avatar name={g.name} size={20} />
            <span className="sr-only">{g.name} </span>+{g.points}
          </span>
        ))}
      </span>
      <span className="whitespace-nowrap text-xs font-extrabold text-rl-muted">
        <span aria-hidden="true">
          {guessed.length}/{eligible} ✓
        </span>
        <span className="sr-only">
          {guessed.length} de {eligible} adivinaron
        </span>
      </span>
      {action}
    </header>
  );
}
