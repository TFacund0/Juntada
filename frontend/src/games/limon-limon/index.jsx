import { LocalGame } from "./LocalGame";
import { ConfigPanel } from "./ConfigPanel";
import { RoundView } from "./RoundView";

// Card-based game with a Spanish ("truco") deck: in a circle with the deck in
// the middle, players reveal cards one by one in turn order and the group
// decides out loud who eats each card — nothing is assigned automatically,
// only the (editable) meaning of each card value is shown as a reference.
// Players can join anytime, even mid-deck. When the deck runs out, whoever
// has eaten the most cards loses.
export const limonLimonGame = {
  id: "limon-limon",
  label: "Limón Limón",
  icon: "🍋",
  description: "Con un mazo de truco, se revela una carta por turno y el grupo decide quién se la come. El que junta más cartas, pierde.",
  minPlayers: 2,
  LocalGame,
  ConfigPanel,
  RoundView,
};
