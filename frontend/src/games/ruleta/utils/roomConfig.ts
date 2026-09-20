import type { RoomPublicState } from "@juntada/shared-types";
import type { Entry } from "../types/roomConfig";

export interface RuletaConfig {
  entries?: Entry[];
  mode?: "keep" | "eliminate";
}

/** Shared `room.config` cast — previously duplicated (and drifting) across LobbyInfo.tsx, ConfigPanel.tsx and index.tsx's canStart. */
export function getRuletaConfig(room: RoomPublicState): RuletaConfig {
  return (room.config ?? {}) as RuletaConfig;
}
