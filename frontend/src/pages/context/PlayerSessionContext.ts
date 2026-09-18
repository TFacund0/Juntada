import type { JoinLink } from "../../features/multiplayer/utils/joinLink";
import { createRequiredContext } from "./createRequiredContext";

export interface PlayerSessionContextValue {
  playerName: string;
  savePlayerName: (name: string) => void;
  validJoinLink: JoinLink | null;
}

export const [PlayerSessionContext, usePlayerSessionContext] = createRequiredContext<PlayerSessionContextValue>("PlayerSessionContext");
