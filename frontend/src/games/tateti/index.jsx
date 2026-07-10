import { ComingSoon } from "../../components/ComingSoon";

// Classic tic-tac-toe, 1v1. Menu entry only for now — see ComingSoon.
export const tatetiGame = {
  id: "tateti",
  label: "Ta-Te-Ti",
  description: "El clásico 3 en raya, uno contra uno. Rápido y para picar entre rondas de otros juegos.",
  minPlayers: 2,
  comingSoon: true,
  LocalGame: () => <ComingSoon label="Ta-Te-Ti" />,
  ConfigPanel: () => <ComingSoon label="Ta-Te-Ti" />,
  RoundView: () => <ComingSoon label="Ta-Te-Ti" />,
};
