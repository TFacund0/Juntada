import { ComingSoon } from "../../components/ComingSoon";

// Bracket/fixture organizer for FIFA sessions between friends: group stage
// or knockout, with matches and results tracked. Menu entry only for now —
// see ComingSoon.
export const torneoFifaGame = {
  id: "torneo-fifa",
  label: "Torneo FIFA",
  icon: "🏆",
  description: "Armá un torneo de FIFA entre amigos: fase de grupos o eliminación directa, con fixture y resultados.",
  minPlayers: 4,
  comingSoon: true,
  LocalGame: () => <ComingSoon label="Torneo FIFA" />,
  ConfigPanel: () => <ComingSoon label="Torneo FIFA" />,
  RoundView: () => <ComingSoon label="Torneo FIFA" />,
};
