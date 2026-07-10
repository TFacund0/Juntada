import { LocalGame } from "./LocalGame";
import { ConfigPanel } from "./ConfigPanel";
import { RoundView } from "./RoundView";

export const impostorGame = {
  id: "impostor",
  label: "El Impostor",
  icon: "🕵️",
  description: "Todos reciben la misma palabra menos el impostor. Encontralo antes de que se salga con la suya.",
  minPlayers: 3,
  LocalGame,
  ConfigPanel,
  RoundView,
};
