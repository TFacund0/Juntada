import { ComingSoon } from "../../components/ComingSoon";

// A configurable spinner: the group loads whatever options they want
// ("quién arranca", "qué comemos", prendas/consecuencias, etc.) and spins
// for a random pick. Menu entry only for now — see ComingSoon.
export const ruletaGame = {
  id: "ruleta",
  label: "Ruleta",
  icon: "🎡",
  description: "Cargá las opciones que quieras y girala para que el grupo decida algo al azar.",
  minPlayers: 1,
  comingSoon: true,
  LocalGame: () => <ComingSoon label="Ruleta" />,
  ConfigPanel: () => <ComingSoon label="Ruleta" />,
  RoundView: () => <ComingSoon label="Ruleta" />,
};
