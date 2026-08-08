import { TurnOrderEditor } from "../../../components/game-kit/TurnOrderEditor";
import { DescriptionsEditor } from "./DescriptionsEditor";
import type { ConfigPanelProps } from "../../gameTypes";

// Host-only, se muestra en el lobby: define el orden de turno (arranca en
// orden de llegada, pero se puede reordenar) y el significado de cada carta.
export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const config = room.config as { descriptions?: Record<string, string>; turnOrder?: string[] };
  const descriptions = config.descriptions || {};

  return (
    <div>
      <TurnOrderEditor
        players={room.players}
        turnOrder={config.turnOrder}
        onChange={turnOrder => updateConfig({ turnOrder })}
        label="Orden de turno"
        helpText="Así van a ir pasando el mazo. Los que se sumen después entran al final."
      />

      <DescriptionsEditor
        descriptions={descriptions}
        onChange={(key, value) => updateConfig({ descriptions: { ...descriptions, [key]: value } })}
      />
    </div>
  );
}
