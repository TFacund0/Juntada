import type { GameDef } from "../../../games/gameTypes";
import { getGame } from "../../../games/registry";
import type { RoomPublicState, GroupPublicState, PublicPlayer } from "@juntada/shared-types";
import type { RoomSession } from "../services/multiplayerSession";

interface UseShellPermissionsArgs {
  me: RoomSession | null | undefined;
  room: RoomPublicState | null | undefined;
  group: GroupPublicState | null | undefined;
  gameId: string | null;
}

/**
 * Pure derived values off `me`/`room`/`group`/`gameId` — no state, no
 * effects. Kept as a `use*` hook purely for call-site symmetry with the
 * other composition-root units and to leave room for future memoization;
 * a plain function would work identically today. Verbatim from
 * useMultiplayerGameShell.ts's former inline derivation.
 */
export function useShellPermissions({ me, room, group, gameId }: UseShellPermissionsArgs): {
  isHost: boolean;
  isGroupHost: boolean;
  myPlayer: PublicPlayer | undefined;
  selectedGame: GameDef | undefined;
  activeGame: GameDef | undefined;
} {
  const isHost = !!(me && room && room.hostId === me.playerId);
  const isGroupHost = !!(me && group && group.hostId === me.playerId);
  const myPlayer = room?.players?.find(p => p.id === me?.playerId);
  const selectedGame = gameId ? getGame(gameId) : undefined;
  const activeGame = room ? getGame(room.gameType) : selectedGame;

  return { isHost, isGroupHost, myPlayer, selectedGame, activeGame };
}
