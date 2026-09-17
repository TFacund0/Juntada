import type { RoomPublicState } from "@juntada/shared-types";

export interface QuienSoyConfig {
  wordSource?: "categories" | "suggested";
  activeCategories?: Record<string, boolean>;
  turnOrder?: string[];
}

/** Shared `room.config` cast — previously duplicated (and drifting) between LobbyInfo.tsx and ConfigPanel.tsx. */
export function getQuienSoyConfig(room: RoomPublicState): QuienSoyConfig {
  return (room.config ?? {}) as QuienSoyConfig;
}
