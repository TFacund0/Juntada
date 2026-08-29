import { useEffect } from "react";
import type { RoomPublicState } from "@juntada/shared-types";
import { usePrevious } from "../../../hooks/ui/usePrevious";

interface UsePlayerPresenceToastsArgs {
  room: RoomPublicState | null;
  myPlayerId: string | undefined;
  setStatusToast: (message: string | null) => void;
}

/**
 * Player disconnects/reconnects only ever show up as a flipped `online` flag
 * buried in the next full room-state broadcast — there's no distinct server
 * event for it. So this diffs each new player list against the previous one
 * (by id) and surfaces a brief toast for whoever flipped, skipping ourselves
 * (we already know our own connection state from the reconnect banner).
 */
export function usePlayerPresenceToasts({ room, myPlayerId, setStatusToast }: UsePlayerPresenceToastsArgs): void {
  const snapshot = room ? Object.fromEntries(room.players.map(p => [p.id, p.online])) : undefined;
  const prevOnline = usePrevious(snapshot);
  useEffect(() => {
    if (!room) return;
    for (const p of room.players) {
      if (p.id === myPlayerId) continue;
      const wasOnline = prevOnline?.[p.id];
      if (wasOnline !== undefined && wasOnline !== p.online) {
        setStatusToast(p.online ? `${p.name} se reconectó` : `${p.name} se desconectó`);
      }
    }
  }, [room, myPlayerId, prevOnline, setStatusToast]);
}
