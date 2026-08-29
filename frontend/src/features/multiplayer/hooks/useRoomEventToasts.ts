import { useEffect } from "react";
import type { RoomPublicState } from "@juntada/shared-types";
import { usePrevious } from "../../../hooks/ui/usePrevious";

interface UseRoomEventToastsArgs {
  room: RoomPublicState | null;
  setStatusToast: (message: string | null) => void;
  setLobbyTab: (tab: "players" | "config") => void;
}

interface RoomSnapshot {
  code: string;
  phase: string;
  players: Record<string, string>;
}

/**
 * Same reusable toast as usePlayerPresenceToasts, for two more events that
 * otherwise happen silently under everyone else: someone interrupting the
 * match with "Volver al lobby" (any player, not just the host) — relevant in
 * any online room, standalone or group — and, group instances only, a member
 * leaving back to the group screen ("Volver al grupo"). Both are detected
 * purely by diffing the room's phase/roster between renders — no dedicated
 * server message needed.
 */
export function useRoomEventToasts({ room, setStatusToast, setLobbyTab }: UseRoomEventToastsArgs): void {
  const snapshot: RoomSnapshot | null = room
    ? {
        code: room.code,
        phase: room.phase,
        players: Object.fromEntries(room.players.map(p => [p.id, p.name])),
      }
    : null;
  const prev = usePrevious(snapshot);

  useEffect(() => {
    if (!room) return;
    // A different room/instance than the one we were last watching — don't
    // compare across them (e.g. just switched instances inside a group).
    if (prev && prev.code === room.code) {
      if (prev.phase !== "lobby" && room.phase === "lobby") {
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
  }, [room, prev, setStatusToast, setLobbyTab]);
}
