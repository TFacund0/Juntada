import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "@juntada/shared-types";
import { Avatar } from "../../../components/ui/Avatar";
import "./FloatingChat.css";

// Quick taps for mid-round chatter that shouldn't require opening the
// keyboard — only offered on a channel that opts in via `quickReactions`
// (the game-instance one; typing mid-round is the last thing a player wants
// to stop and do).
const QUICK_REACTIONS = ["👏", "🔥", "😂", "😮", "❤️"];

const MAX_MESSAGE_LENGTH = 300;
const DEFAULT_POS = { right: 18, bottom: 96 };

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

/**
 * Burbuja flotante arrastrable que se expande a un panel de chat centrado.
 * Vive montada como hermana de la pantalla activa (grupo/lobby/partida) en
 * MultiplayerGame.tsx — nunca bloquea esa pantalla mientras está cerrada, y
 * al tocarla cubre el centro con el chat sin navegar a ningún otro lado; la
 * ✕ simplemente vuelve a lo que ya estaba montado debajo.
 *
 * Soporta más de un `channel` (grupo + sala a la vez, cuando la partida
 * actual pertenece a un grupo) mostrando tabs arriba del panel — un jugador
 * en plena partida puede seguir viendo/mandando mensajes al grupo sin salir
 * de la sala.
 */
export function FloatingChat({ channels, defaultChannelId }: FloatingChatProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [activeChannelId, setActiveChannelId] = useState(defaultChannelId ?? channels[0]?.id);
  const [unreadByChannel, setUnreadByChannel] = useState<Record<string, number>>({});
  const lastSeenRef = useRef<Record<string, number>>({});
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const msgsRef = useRef<HTMLDivElement>(null);

  // Falls back to the first channel if the active id ever stops matching one
  // (e.g. a caller's channel list shrinks) instead of rendering nothing.
  const activeChannel = channels.find(c => c.id === activeChannelId) ?? channels[0];

  const channelKey = channels.map(c => `${c.id}:${c.messages.length}`).join("|");
  // Tracks unread per channel: the currently open one (while the panel is
  // shown) is always "seen"; any other channel that gained messages since
  // last seen bumps its own counter instead of a single blanket badge, so
  // switching tabs doesn't wrongly clear an unread count on the other one.
  useEffect(() => {
    setUnreadByChannel(prev => {
      const next = { ...prev };
      for (const ch of channels) {
        const lastSeen = lastSeenRef.current[ch.id] ?? ch.messages.length;
        const isVisible = open && ch.id === activeChannel?.id;
        if (isVisible) {
          next[ch.id] = 0;
        } else if (ch.messages.length > lastSeen) {
          next[ch.id] = (next[ch.id] ?? 0) + (ch.messages.length - lastSeen);
        }
        lastSeenRef.current[ch.id] = ch.messages.length;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey, open, activeChannel?.id]);

  const totalUnread = useMemo(() => Object.values(unreadByChannel).reduce((a, b) => a + b, 0), [unreadByChannel]);

  useEffect(() => {
    if (open && msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [open, activeChannel?.messages.length]);

  function clampToViewport(x: number, y: number): { x: number; y: number } {
    const size = 56;
    const margin = 8;
    const maxX = window.innerWidth - size - margin;
    const maxY = window.innerHeight - size - margin;
    return { x: Math.min(Math.max(x, margin), Math.max(margin, maxX)), y: Math.min(Math.max(y, margin), Math.max(margin, maxY)) };
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    const rect = bubbleRef.current!.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top, moved: false };
    bubbleRef.current!.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
    setPos(clampToViewport(drag.origX + dx, drag.origY + dy));
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    bubbleRef.current?.releasePointerCapture(e.pointerId);
    if (drag && !drag.moved) setOpen(true);
  }

  function submit(value: string) {
    if (!activeChannel) return;
    const trimmed = value.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!trimmed) return;
    activeChannel.onSend(trimmed);
    setText("");
  }

  if (!activeChannel) return null;

  const bubbleStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : { right: DEFAULT_POS.right, bottom: DEFAULT_POS.bottom };

  return (
    <>
      <button
        ref={bubbleRef}
        type="button"
        className={`jt-chatbubble jt-chatbubble--${activeChannel.accent}${totalUnread > 0 ? " jt-chatbubble--pulse" : ""}`}
        style={bubbleStyle}
        aria-label="Abrir chat"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className="jt-chatbubble-pulse" aria-hidden="true" />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        {totalUnread > 0 && <span className="jt-chatbubble-badge">{totalUnread > 9 ? "9+" : totalUnread}</span>}
      </button>

      {open && (
        <div className="jt-chatoverlay" onClick={() => setOpen(false)}>
          <div className={`jt-chatsheet jt-chatsheet--${activeChannel.accent}`} onClick={e => e.stopPropagation()}>
            <div className="jt-chatsheet-head">
              <div className="jt-chatsheet-who">
                <span className="jt-chatsheet-dot" />
                <div>
                  <p className="jt-chatsheet-title">{activeChannel.title}</p>
                  <p className="jt-chatsheet-sub">{activeChannel.subtitle}</p>
                </div>
              </div>
              <button type="button" className="jt-chatsheet-close" aria-label="Cerrar chat" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>

            {channels.length > 1 && (
              <div className="jt-chatsheet-tabs" role="tablist" aria-label="Elegir chat">
                {channels.map(ch => (
                  <button
                    key={ch.id}
                    type="button"
                    role="tab"
                    aria-selected={ch.id === activeChannel.id}
                    className={`jt-chatsheet-tab jt-chatsheet-tab--${ch.accent}${ch.id === activeChannel.id ? " jt-chatsheet-tab--active" : ""}`}
                    onClick={() => setActiveChannelId(ch.id)}
                  >
                    {ch.tabLabel}
                    {unreadByChannel[ch.id] > 0 && ch.id !== activeChannel.id && <span className="jt-chatsheet-tabdot" />}
                  </button>
                ))}
              </div>
            )}

            <div className="jt-chatsheet-msgs jt-thin-scrollbar" ref={msgsRef}>
              {activeChannel.messages.length === 0 && <p className="jt-chatsheet-empty">Todavía no hay mensajes. ¡Arrancá la charla!</p>}
              {activeChannel.messages.map(m => {
                const mine = m.playerId === activeChannel.myPlayerId;
                return (
                  <div key={m.id} className={`jt-chatmsg${mine ? " jt-chatmsg--me" : ""}`}>
                    <Avatar name={m.playerName} size={26} />
                    <div className="jt-chatmsg-content">
                      <p className="jt-chatmsg-meta">
                        <span className="jt-chatmsg-name">{mine ? "Vos" : m.playerName}</span>
                        <span className="jt-chatmsg-time">{formatTime(m.ts)}</span>
                      </p>
                      <p className="jt-chatmsg-bubble">{m.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {activeChannel.quickReactions && (
              <div className="jt-chatsheet-quick">
                {QUICK_REACTIONS.map(r => (
                  <button key={r} type="button" className="jt-chatsheet-quickbtn" onClick={() => submit(r)}>
                    {r}
                  </button>
                ))}
              </div>
            )}

            <form
              className="jt-chatsheet-composer"
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
              />
              <button type="submit" className="jt-chatsheet-send" aria-label="Enviar" disabled={!text.trim()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2 11 13" />
                  <path d="M22 2 15 22l-4-9-9-4 20-7z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
