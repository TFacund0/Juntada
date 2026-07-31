import { ComingSoon } from "../../components/game-kit/ComingSoon";
import type { GameDef } from "../gameTypes";

// Competencia de toques: gana quien logre tocar la pantalla más veces en
// el tiempo límite. Menu entry only for now — see ComingSoon.
export const spamTapGame: GameDef = {
  id: "spam-tap",
  label: "Spam Tap",
  icon: "👆",
  description: "Competencia de toques: gana quien logre tocar la pantalla más veces antes de que se acabe el tiempo.",
  minPlayers: 2,
  category: "rapidos",
  comingSoon: true,
  rules: [
    "Al arrancar la ronda, cada jugador toca su pantalla lo más rápido que pueda.",
    "Se cuenta la cantidad de toques hasta que se acaba el tiempo.",
    "Gana quien haya sumado más toques.",
  ],
  LocalGame: () => <ComingSoon label="Spam Tap" />,
  ConfigPanel: () => <ComingSoon label="Spam Tap" />,
  RoundView: () => <ComingSoon label="Spam Tap" />,
};
