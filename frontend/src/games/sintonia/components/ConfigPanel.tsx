import type { ConfigPanelProps } from "../../gameTypes";
import { PlayModeConfig } from "./PlayModeConfig";

// Host-only rules editor shown in the multiplayer lobby: whether the game
// keeps going indefinitely (rotating psychic each round) or ends after a
// fixed number of rounds, showing a winner and letting the host start fresh.
export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const config = room.config as { playMode?: "endless" | "rounds"; roundLimit?: number };
  return <PlayModeConfig playMode={config.playMode || "endless"} roundLimit={config.roundLimit || 5} onChange={updateConfig} />;
}
