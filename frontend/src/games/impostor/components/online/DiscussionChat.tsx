import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { T } from "../../../../theme/styles/classes";
import { Btn } from "../../../../components/ui/Btn";
import { STICKY_ACTION_BAR_CLEARANCE } from "../../../../components/setup/StickyActionBar";
import type { RoundViewProps } from "../../../gameTypes";

interface DiscussionChatProps {
  chat: { playerId: string; name: string; text: string; ts: number }[];
  myPlayerId: string | undefined;
  send: RoundViewProps["send"];
}

// Only rendered when the host set discussionMode to "chat" (see
// DiscussionPhaseScreen) — a plain scrollable log + input, auto-scrolling to
// the newest message as they come in over the room's normal `state`
// broadcasts (see send_chat_message in engine.ts). `chat` already lives in
// room state, so a reconnect mid-discussion sees the full history for free.
export function DiscussionChat({ chat, myPlayerId, send }: DiscussionChatProps) {
  const [text, setText] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  const sendMessage = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    send({ type: "send_chat_message", text: trimmed });
    setText("");
  };

  return (
    <div className={T.card} style={{ marginBottom: STICKY_ACTION_BAR_CLEARANCE }}>
      <style>{`
        .impostor-discussion-chat-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .impostor-discussion-chat-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <span className={T.label}>Chat</span>
      <div ref={logRef} className="impostor-discussion-chat-scroll max-h-[220px] overflow-y-auto mb-2.5">
        {chat.length === 0 ? (
          <p className={clsx(T.muted, "my-1")}>Nadie escribió nada todavía.</p>
        ) : (
          chat.map((m, i) => {
            const isMe = m.playerId === myPlayerId;
            return (
              <p key={i} className="text-sm my-1 text-[var(--jt-muted-text)]">
                <strong className={isMe ? "text-[#5DCAA5]" : "text-[#FF8A8A]"}>{isMe ? "Vos" : m.name}: </strong>
                <span className="text-[#e8e4f0]">{m.text}</span>
              </p>
            );
          })
        )}
      </div>
      {/* flex-wrap + min-w: mismo motivo que el resto de los inputs+botón de
          esta app — sin esto, el botón le come el ancho al input en un
          contenedor angosto. */}
      <div className="flex flex-wrap gap-2">
        <input
          className={clsx(T.input, "min-w-[140px] flex-1")}
          placeholder="Escribí un mensaje..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") sendMessage();
          }}
        />
        <Btn variant="ghost" onClick={sendMessage} style={{ width: "auto", padding: "11px 18px" }}>
          Enviar
        </Btn>
      </div>
    </div>
  );
}
