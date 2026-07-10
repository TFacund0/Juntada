import { ComingSoon } from "../../components/ComingSoon";

// Card-based punishment game with a Spanish ("truco") deck: players draw
// cards one by one and each card triggers a specific punishment/consequence
// for whoever draws it. Menu entry only for now — see ComingSoon.
export const limonLimonGame = {
  id: "limon-limon",
  label: "Limón Limón",
  icon: "🍋",
  description: "Con un mazo de truco, cada uno saca una carta por turno y cumple el castigo que le toque según la carta.",
  minPlayers: 2,
  comingSoon: true,
  LocalGame: () => <ComingSoon label="Limón Limón" />,
  ConfigPanel: () => <ComingSoon label="Limón Limón" />,
  RoundView: () => <ComingSoon label="Limón Limón" />,
};
