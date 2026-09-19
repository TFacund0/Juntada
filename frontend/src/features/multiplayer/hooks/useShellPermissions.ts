import type { GameDef } from "../../../games/gameTypes";
import { getGame } from "../../../games/registry";
import type { RoomPublicState, GroupPublicState, PublicPlayer } from "@juntada/shared-types";
import type { RoomSession, GroupSession } from "../services/multiplayerSession";

interface UseShellPermissionsArgs {
  me: RoomSession | null | undefined;
  groupMe: GroupSession | null | undefined;
  room: RoomPublicState | null | undefined;
  group: GroupPublicState | null | undefined;
  gameId: string | null;
}

/**
 * Pure derived values off `me`/`groupMe`/`room`/`group`/`gameId` — no state,
 * no effects. Kept as a `use*` hook purely for call-site symmetry with the
 * other composition-root units and to leave room for future memoization;
 * a plain function would work identically today. Verbatim from
 * useMultiplayerGameShell.ts's former inline derivation, except isGroupHost
 * now reads `groupMe` instead of `me`: `me` (RoomSession) is only populated
 * by the "joined" message and is null while sitting on the bare GroupScreen
 * (no active instance), which made isGroupHost permanently false there —
 * the group's own session (`groupMe`, set by "group_joined") is the one
 * that actually tracks the player's id in that context.
 */
export function useShellPermissions({ me, groupMe, room, group, gameId }: UseShellPermissionsArgs): {
  isHost: boolean;
  isGroupHost: boolean;
  myPlayer: PublicPlayer | undefined;
  selectedGame: GameDef | undefined;
  activeGame: GameDef | undefined;
} {
  const isHost = !!(me && room && room.hostId === me.playerId);
  const isGroupHost = !!(groupMe && group && group.hostId === groupMe.playerId);
  const myPlayer = room?.players?.find(p => p.id === me?.playerId);
  const selectedGame = gameId ? getGame(gameId) : undefined;
  const activeGame = room ? getGame(room.gameType) : selectedGame;

  return { isHost, isGroupHost, myPlayer, selectedGame, activeGame };
}
