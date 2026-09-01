import type { GameDef } from "../../games/gameTypes";
import { createRequiredContext } from "./createRequiredContext";

// Everything the page components under pages/ need from useAppSession — the
// game/mode/group identity of whatever's currently selected. Split out of
// the old single AppOutletContext so a page that only reads gameId/mode
// doesn't also subscribe to curtain/shell/player-session changes.
export interface GameSessionContextValue {
  gameId: string | null;
  setGameId: (id: string | null) => void;
  mode: "local" | "multi" | null;
  setMode: (mode: "local" | "multi" | null) => void;
  game: GameDef | null | undefined;
  groupFlow: boolean;
  groupIntent: "create" | "join" | undefined;
  pendingGroupJoinCode: string | null;
  switchToGroupJoin: (code: string) => void;
  setRoomCode: (code: string | null) => void;
  setGroupCode: (code: string | null) => void;
  groupAttached: boolean;
  setGroupAttached: (attached: boolean) => void;
  setRoomPhase: (phase: string | null) => void;
  handleRoomGameType: (roomGameType: string | null) => void;
  GAME_LIST: GameDef[];
}

export const [GameSessionContext, useGameSessionContext] = createRequiredContext<GameSessionContextValue>("GameSessionContext");
