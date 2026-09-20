import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatChannel } from "../components/FloatingChat";

interface UseChannelUnreadArgs {
  channels: ChatChannel[];
  open: boolean;
  activeChannelId: string | undefined;
}

interface UseChannelUnreadResult {
  unreadByChannel: Record<string, number>;
  totalUnread: number;
}

/**
 * Cuenta de no-leídos por canal — extraído de FloatingChat.tsx verbatim. El
 * canal actualmente abierto (mientras el panel está mostrado) siempre está
 * "visto"; cualquier otro canal que sumó mensajes desde la última vez que se
 * vio suma a su propio contador en vez de un solo badge global, así que
 * cambiar de tab no borra por error el no-leído del otro canal.
 */
export function useChannelUnread({ channels, open, activeChannelId }: UseChannelUnreadArgs): UseChannelUnreadResult {
  const [unreadByChannel, setUnreadByChannel] = useState<Record<string, number>>({});
  const lastSeenRef = useRef<Record<string, number>>({});

  const channelKey = channels.map(c => `${c.id}:${c.messages.length}`).join("|");
  useEffect(() => {
    setUnreadByChannel(prev => {
      const next = { ...prev };
      for (const ch of channels) {
        const lastSeen = lastSeenRef.current[ch.id] ?? ch.messages.length;
        const isVisible = open && ch.id === activeChannelId;
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
  }, [channelKey, open, activeChannelId]);

  const totalUnread = useMemo(() => Object.values(unreadByChannel).reduce((a, b) => a + b, 0), [unreadByChannel]);

  return { unreadByChannel, totalUnread };
}
