import { TurnOrderEditor } from "../../../components/game-kit/TurnOrderEditor";
import type { ConfigPanelProps } from "../../gameTypes";
import { WordSourceConfig } from "./WordSourceConfig";
import { getQuienSoyConfig } from "../utils/roomConfig";

// Host-only setup shown in the multiplayer lobby: where the words come from
// (predefined categories vs. player-suggested-and-voted), plus who goes in
// what order once play starts.
export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const config = getQuienSoyConfig(room);

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
