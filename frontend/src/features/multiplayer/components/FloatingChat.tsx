import { useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import type { ChatMessage } from "@juntada/shared-types";
import { Avatar } from "../../../components/ui/Avatar";
import { useFloatingChatDrag } from "../hooks/useFloatingChatDrag";
import { useChannelUnread } from "../hooks/useChannelUnread";
import { useAutoScrollToBottom } from "../hooks/useAutoScrollToBottom";

// Quick taps for mid-round chatter that shouldn't require opening the
// keyboard — only offered on a channel that opts in via `quickReactions`
// (the game-instance one; typing mid-round is the last thing a player wants
// to stop and do).
const QUICK_REACTIONS = ["👏", "🔥", "😂", "😮", "❤️"];

const MAX_MESSAGE_LENGTH = 300;

// One tab inside the floating chat — "grupo" and "sala" are both built by
// MultiplayerGame.tsx (the one place that knows whether a room is attached
// to a group at all) and handed down as plain data, so this component never
// needs to know about rooms/groups/sockets itself, just how to render and
// switch between whatever channels it's given.
export interface ChatChannel {
  id: string;
  tabLabel: string;
  title: string;
  subtitle: string;
  accent: "group" | "room";
  messages: ChatMessage[];
  myPlayerId?: string;
  onSend: (text: string) => void;
  quickReactions?: boolean;
}

interface FloatingChatProps {
  channels: ChatChannel[];
  defaultChannelId?: string;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Dos variantes de acento según `accent`: "group" reusa el morado de
// siempre (--jt-accent); "room" usa el verde ya usado para CTAs positivas
// (--jt-cta-from/to) para que un vistazo alcance para saber en qué chat
// estás sin leer el título.
function bubbleClass(accent: "group" | "room"): string {
  return clsx(
    "fixed z-[var(--jt-z-chat-bubble)] w-14 h-14 rounded-full border-none flex items-center justify-center cursor-grab touch-none text-white transition-[box-shadow,transform] duration-150",
    accent === "room"
      ? "bg-[linear-gradient(135deg,var(--jt-cta-from),var(--jt-cta-to))] shadow-[0_10px_24px_-8px_var(--jt-cta-shadow,rgba(29,158,117,0.4))]"
      : "bg-jt-accent shadow-[0_10px_24px_-8px_rgba(127,119,221,0.55)]",
    "active:cursor-grabbing active:scale-[0.96]",
  );
}

function bubbleRingClass(accent: "group" | "room", pulsing: boolean): string {
  return clsx(
    "absolute -inset-1.5 rounded-full border-2 opacity-0 pointer-events-none",
    accent === "room" ? "border-jt-cta-from" : "border-jt-accent",
    pulsing && "animate-[jt-chatbubble-ring_1.6s_ease-out_infinite] motion-reduce:animate-none motion-reduce:opacity-35",
  );
}

function sheetTabClass(accent: "group" | "room", active: boolean): string {
  return clsx(
    "relative flex-1 px-2.5 py-[7px] rounded-[10px] border text-xs font-bold font-[inherit] cursor-pointer transition-colors",
    active && accent === "group" && "bg-jt-accent-soft border-jt-accent-border-soft text-jt-accent-strong",
    active &&
      accent === "room" &&
      "bg-[color-mix(in_srgb,var(--jt-cta-from)_18%,transparent)] border-[color-mix(in_srgb,var(--jt-cta-from)_45%,transparent)] text-[#6fe0b8]",
    !active && "bg-jt-card-bg border-jt-row-border text-jt-muted-text",
  );
}

/**
 * Burbuja flotante arrastrable que se expande a un panel de chat centrado.
 * Se usa como hermana de la pantalla activa (grupo/lobby/partida) en
 * MultiplayerGame.tsx — nunca bloquea esa pantalla mientras está cerrada, y
 * al tocarla cubre el centro con el chat sin navegar a ningún otro lado; la
 * ✕ simplemente vuelve a lo que ya estaba montado debajo.
 *
 * Todo el componente (burbuja + overlay) se portea a document.body por el
 * mismo motivo que StickyActionBar: el `transform` de ScreenFade en un
 * ancestro atrapa cualquier `position: fixed` de acá adentro, así que sin
 * portal esto quedaría compitiendo en z-index solo contra sus hermanos
 * dentro de esa pantalla — nunca contra un StickyActionBar, que sí escapa a
 * document.body.
 *
 * Soporta más de un `channel` (grupo + sala a la vez, cuando la partida
 * actual pertenece a un grupo) mostrando tabs arriba del panel — un jugador
 * en plena partida puede seguir viendo/mandando mensajes al grupo sin salir
 * de la sala. El canal por defecto ya resuelve "grupo si estás en el grupo,
 * sala/juego si estás dentro de una sala" — lo decide quien llama (ver
 * MultiplayerGame.tsx) pasando o no `defaultChannelId="room"`.
 *
 * Cada mensaje nuevo entra con un pop sutil (`jt-chatmsg-in`, ver
 * theme/tailwind.css) — como cada `<div>` de mensaje tiene su propio
 * `key={m.id}` estable, React solo monta el `<div>` del mensaje agregado
 * (los anteriores no se remontan), así que la animación de "mount" dispara
 * una sola vez por mensaje real, no en cada re-render.
 */
export function FloatingChat({ channels, defaultChannelId }: FloatingChatProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [activeChannelId, setActiveChannelId] = useState(defaultChannelId ?? channels[0]?.id);

  // Falls back to the first channel if the active id ever stops matching one
  // (e.g. a caller's channel list shrinks) instead of rendering nothing.
  const activeChannel = channels.find(c => c.id === activeChannelId) ?? channels[0];

  const { bubbleRef, bubbleStyle, onPointerDown, onPointerMove, onPointerUp } = useFloatingChatDrag({
    onTap: () => setOpen(true),
  });
  const { unreadByChannel, totalUnread } = useChannelUnread({ channels, open, activeChannelId: activeChannel?.id });
  const msgsRef = useAutoScrollToBottom([open, activeChannel?.messages.length]);

  function submit(value: string) {
    if (!activeChannel) return;
    const trimmed = value.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!trimmed) return;
    activeChannel.onSend(trimmed);
    setText("");
  }

  if (!activeChannel) return null;

  const pulsing = totalUnread > 0;

  return createPortal(
    <>
      <button
        ref={bubbleRef as React.Ref<HTMLButtonElement>}
        type="button"
        className={bubbleClass(activeChannel.accent)}
        style={bubbleStyle}
        aria-label="Abrir chat"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className={bubbleRingClass(activeChannel.accent, pulsing)} aria-hidden="true" />
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-[22px] h-[22px] pointer-events-none"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#e24b4a] border-2 border-jt-bg text-white text-[10px] font-extrabold flex items-center justify-center pointer-events-none">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[var(--jt-z-chat-sheet)] bg-[rgba(15,12,29,0.72)] backdrop-blur-[3px] flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[480px] h-[min(78vh,640px)] bg-jt-surface border border-jt-card-border rounded-[20px] flex flex-col
              shadow-[0_20px_60px_rgba(0,0,0,0.5)] animate-[jt-chatsheet-in_220ms_cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:animate-none"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2.5 px-4 pt-4 pb-3 border-b border-jt-row-border shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={clsx("w-2 h-2 rounded-full shrink-0", activeChannel.accent === "room" ? "bg-jt-cta-from" : "bg-jt-accent")}
                />
                <div>
                  <p className="m-0 text-[14.5px] font-extrabold text-white whitespace-nowrap overflow-hidden text-ellipsis">
                    {activeChannel.title}
                  </p>
                  <p className="m-0 mt-0.5 text-[11px] text-jt-muted-text whitespace-nowrap overflow-hidden text-ellipsis">
                    {activeChannel.subtitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Cerrar chat"
                onClick={() => setOpen(false)}
                className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full border border-jt-card-border bg-jt-card-bg text-jt-muted-text
                  cursor-pointer text-[13px] transition-[transform,color] duration-200 hover:text-white hover:scale-[1.08]"
              >
                ✕
              </button>
            </div>

            {channels.length > 1 && (
              <div className="flex gap-1.5 px-4 pt-2.5 shrink-0" role="tablist" aria-label="Elegir chat">
                {channels.map(ch => (
                  <button
                    key={ch.id}
                    type="button"
                    role="tab"
                    aria-selected={ch.id === activeChannel.id}
                    className={sheetTabClass(ch.accent, ch.id === activeChannel.id)}
                    onClick={() => setActiveChannelId(ch.id)}
                  >
                    {ch.tabLabel}
                    {unreadByChannel[ch.id] > 0 && ch.id !== activeChannel.id && (
                      <span className="inline-block w-1.5 h-1.5 ml-1.5 rounded-full bg-[#e24b4a] align-middle" />
                    )}
                  </button>
                ))}
              </div>
            )}

            <div
              className="flex-1 overflow-y-auto pt-3.5 px-3.5 pb-1 flex flex-col gap-3 jt-thin-scrollbar"
              ref={msgsRef as React.Ref<HTMLDivElement>}
            >
              {activeChannel.messages.length === 0 && (
                <p className="m-auto text-center text-jt-muted-text text-[13px] max-w-[220px]">
                  Todavía no hay mensajes. ¡Arrancá la charla!
                </p>
              )}
              {activeChannel.messages.map(m => {
                const mine = m.playerId === activeChannel.myPlayerId;
                return (
                  <div
                    key={m.id}
                    className={clsx(
                      "flex items-end gap-2 max-w-[86%] animate-[jt-chatmsg-in_320ms_ease-out] motion-reduce:animate-none",
                      mine ? "flex-row-reverse self-end" : "self-start",
                    )}
                  >
                    <Avatar name={m.playerName} size={26} />
                    <div className={clsx("min-w-0 flex flex-col", mine && "items-end")}>
                      <p className={clsx("m-0 mb-[3px] flex items-baseline gap-1.5", mine ? "flex-row-reverse ml-0 mr-0.5" : "ml-0.5")}>
                        <span className="text-[10.5px] font-bold text-jt-label">{mine ? "Vos" : m.playerName}</span>
                        <span className="text-[9.5px] tabular-nums text-jt-muted-text">{formatTime(m.ts)}</span>
                      </p>
                      <p
                        className={clsx(
                          "m-0 px-3 py-2 text-[13.5px] leading-[1.42] text-white rounded-[14px] [overflow-wrap:anywhere]",
                          mine
                            ? clsx(
                                "border-transparent rounded-br-[4px]",
                                activeChannel.accent === "room"
                                  ? "bg-[linear-gradient(135deg,var(--jt-cta-from),var(--jt-cta-to))]"
                                  : "bg-jt-accent",
                              )
                            : "bg-jt-card-bg border border-jt-row-border rounded-bl-[4px]",
                        )}
                      >
                        {m.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {activeChannel.quickReactions && (
              <div className="flex gap-1.5 px-3.5 pb-2 shrink-0">
                {QUICK_REACTIONS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => submit(r)}
                    className="w-[34px] h-[34px] rounded-full border border-jt-row-border bg-jt-card-bg text-base flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}

            <form
              className="flex gap-2 px-3 pt-2.5 pb-[calc(14px+env(safe-area-inset-bottom,0px))] border-t border-jt-row-border shrink-0"
              onSubmit={e => {
                e.preventDefault();
                submit(text);
              }}
            >
              <input
                type="text"
                value={text}
                maxLength={MAX_MESSAGE_LENGTH}
                onChange={e => setText(e.target.value)}
                placeholder={activeChannel.accent === "group" ? "Escribí algo…" : "Escribí o mandá una reacción…"}
                className={clsx(
                  "flex-1 min-w-0 rounded-full border border-jt-card-border bg-jt-card-bg text-white px-3.5 py-2.5 text-[13.5px] font-[inherit]",
                  "placeholder:text-jt-muted-text focus-visible:outline-2 focus-visible:outline-offset-1",
                  activeChannel.accent === "room" ? "focus-visible:outline-jt-cta-from" : "focus-visible:outline-jt-accent",
                )}
              />
              <button
                type="submit"
                aria-label="Enviar"
                disabled={!text.trim()}
                className={clsx(
                  "w-[38px] h-[38px] shrink-0 rounded-full border-none text-white flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-default",
                  activeChannel.accent === "room" ? "bg-[linear-gradient(135deg,var(--jt-cta-from),var(--jt-cta-to))]" : "bg-jt-accent",
                )}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="M22 2 11 13" />
                  <path d="M22 2 15 22l-4-9-9-4 20-7z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
