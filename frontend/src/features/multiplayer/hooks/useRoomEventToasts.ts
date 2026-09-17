import { useEffect } from "react";
import type { RoomPublicState } from "@juntada/shared-types";
import { usePrevious } from "../../../hooks/ui/usePrevious";

interface UseRoomEventToastsArgs {
  room: RoomPublicState | null;
  myPlayerId?: string;
  setStatusToast: (message: string | null) => void;
  setLobbyTab: (tab: "players" | "config") => void;
}

interface RoomSnapshot {
  code: string;
  phase: string;
  hostId: string;
  players: Record<string, string>;
}

/**
 * Same reusable toast as usePlayerPresenceToasts, for room events that
 * otherwise happen silently under everyone else:
 * 1. Host reassignment (when hostId changes).
 * 2. Someone interrupting the match with "Volver al lobby" (any player).
 * 3. In group instances, a member leaving back to the group screen ("Volver al grupo").
 * Detected purely by diffing the room state between renders — no dedicated
 * server message needed.
 */
export function useRoomEventToasts({ room, myPlayerId, setStatusToast, setLobbyTab }: UseRoomEventToastsArgs): void {
  const snapshot: RoomSnapshot | null = room
    ? {
        code: room.code,
        phase: room.phase,
        hostId: room.hostId,
        players: Object.fromEntries(room.players.map(p => [p.id, p.name])),
      }
    : null;
  const prev = usePrevious(snapshot);

  useEffect(() => {
    if (!room) return;
    // A different room/instance than the one we were last watching — don't
    // compare across them (e.g. just switched instances inside a group).
    if (prev && prev.code === room.code) {
      if (prev.hostId !== room.hostId) {
        const newHostName = room.players.find(p => p.id === room.hostId)?.name;
        if (room.hostId === myPlayerId) {
          setStatusToast("Ahora sos el anfitrión");
        } else if (newHostName) {
          setStatusToast(`${newHostName} es el nuevo anfitrión`);
        } else {
          setStatusToast("Cambió el anfitrión");
        }
      } else if (prev.phase !== "lobby" && room.phase === "lobby") {
        setStatusToast("Volvieron al lobby");
        // Mirrors LocalGame's own "Nueva partida" flow: land back on the
        // player roster first, not wherever the config tab happened to be
        // left before the match started.
        setLobbyTab("players");
      } else if (room.groupCode !== null) {
        const currentIds = new Set(room.players.map(p => p.id));
        const leftPlayerName = Object.entries(prev.players).find(([id]) => !currentIds.has(id))?.[1];
        if (leftPlayerName) setStatusToast(`${leftPlayerName} volvió al grupo`);
      }
    }
  }, [room, prev, myPlayerId, setStatusToast, setLobbyTab]);
}
