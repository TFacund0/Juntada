import { TurnOrderEditor } from "../../components/TurnOrderEditor";
import type { ConfigPanelProps } from "../gameTypes";
import { WordSourceConfig } from "./WordSourceConfig";

// Host-only setup shown in the multiplayer lobby: where the words come from
// (predefined categories vs. player-suggested-and-voted), plus who goes in
// what order once play starts.
export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const config = room.config as {
    wordSource?: "categories" | "suggested";
    activeCategories?: Record<string, boolean>;
    turnOrder?: string[];
  };

  return (
    <div>
      <WordSourceConfig
        wordSource={config.wordSource || "categories"}
        activeCategories={config.activeCategories || {}}
        onChange={updateConfig}
      />

      <TurnOrderEditor
        players={room.players}
        turnOrder={config.turnOrder}
        onChange={turnOrder => updateConfig({ turnOrder })}
        allowRandom
        label="Orden de los turnos"
        helpText="Quién pregunta/adivina primero en cada ronda."
      />
    </div>
  );
}
