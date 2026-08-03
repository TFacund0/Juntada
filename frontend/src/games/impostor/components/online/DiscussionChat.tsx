import { useEffect, useRef, useState } from "react";
import { S } from "../../../../theme/styles";
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
    <div style={{ ...S.card, marginBottom: STICKY_ACTION_BAR_CLEARANCE }}>
      <style>{`
        .impostor-discussion-chat-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .impostor-discussion-chat-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <span style={S.label}>Chat</span>
      <div ref={logRef} className="impostor-discussion-chat-scroll" style={{ maxHeight: 220, overflowY: "auto", marginBottom: 10 }}>
        {chat.length === 0 ? (
          <p style={{ ...S.muted, margin: "4px 0" }}>Nadie escribió nada todavía.</p>
        ) : (
          chat.map((m, i) => {
            const isMe = m.playerId === myPlayerId;
            return (
              <p key={i} style={{ fontSize: 14, margin: "4px 0", color: "var(--jt-muted-text)" }}>
                <strong style={{ color: isMe ? "#5DCAA5" : "#FF8A8A" }}>{isMe ? "Vos" : m.name}: </strong>
                <span style={{ color: "#e8e4f0" }}>{m.text}</span>
              </p>
            );
          })
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{ ...S.input, flex: 1 }}
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
