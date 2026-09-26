import { memo } from "react";
import clsx from "clsx";
import { Avatar, avatarColor } from "../../../../components/ui/Avatar";
import type { ChatFeedItem } from "../../utils/chatFeed";

interface ChatLineProps {
  item: ChatFeedItem;
  /** Entra con la animación de mensaje nuevo (solo lo que llega en vivo, ver useFreshKeys). */
  fresh?: boolean;
}

const ENTER = "animate-rl-msg-in motion-reduce:animate-none";

/**
 * Una línea del chat de respuestas, como en la referencia: sistema (itálica
 * gris, centrada), acierto (píldora verde centrada, sin la palabra), mensaje
 * propio (derecha, burbuja violeta, sin nombre), "cerca" (burbuja amarilla
 * solo para quien lo escribió) o mensaje de otro (izquierda, avatar y
 * nombre en su color). El texto es del jugador: siempre como texto de
 * React, nunca HTML.
 */
export const ChatLine = memo(function ChatLine({ item, fresh = false }: ChatLineProps) {
  if (item.kind === "sys") {
    return <p className={clsx("m-0 self-center text-center text-xs italic text-rl-muted", fresh && ENTER)}>{item.text}</p>;
  }

  if (item.kind === "ok") {
    return (
      <p
        className={clsx(
          "m-0 flex items-center gap-1.5 self-center rounded-full border border-rl-ok-line bg-rl-ok-soft py-1 pl-1 pr-3 text-[13px] font-extrabold text-rl-ok-text",
          fresh && ENTER,
        )}
      >
        <Avatar name={item.name} size={22} />
        {item.mine ? "¡Adivinaste!" : `${item.name} adivinó`} · +{item.points}
      </p>
    );
  }

  return (
    <div className={clsx("flex max-w-[88%] items-end gap-[7px]", item.mine && "flex-row-reverse self-end", fresh && ENTER)}>
      {!item.mine && <Avatar name={item.name} size={24} />}
      <div
        className={clsx(
          "min-w-0 px-2.5 py-1.5 text-sm leading-[1.3] [overflow-wrap:anywhere]",
          item.mine ? "rounded-[14px_14px_4px_14px]" : "rounded-[14px_14px_14px_4px] bg-rl-surface-2",
          item.close ? "border border-rl-warn-line bg-rl-warn-soft text-rl-warn-text" : item.mine && "bg-rl-accent text-white",
        )}
      >
        {!item.mine && (
          // Aclarado sobre el color del avatar: los fondos de avatar son
          // oscuros y como texto sobre la burbuja no se leerían. Dinámico
          // por jugador, por eso va inline.
          <b
            className="mb-px block text-[11px] font-extrabold"
            style={{ color: `color-mix(in srgb, ${avatarColor(item.name)} 55%, white)` }}
          >
            {item.name}
          </b>
        )}
        <span>{item.text}</span>
        {item.close && <small className="mt-0.5 block text-[10px] font-bold opacity-80">¡Estás cerca! · solo lo ves vos</small>}
      </div>
    </div>
  );
});
