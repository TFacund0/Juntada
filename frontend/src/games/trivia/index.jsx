import { ComingSoon } from "../../components/ComingSoon";

// Kahoot-style trivia: multiple-choice questions shown to everyone at once,
// points for correct + fast answers, live ranking between rounds. Menu
// entry only for now — see ComingSoon.
export const triviaGame = {
  id: "trivia",
  label: "Trivia",
  icon: "🧠",
  description: "Preguntas de opción múltiple para todos a la vez. Sumás más puntos cuanto más rápido y correcto respondas.",
  minPlayers: 2,
  comingSoon: true,
  LocalGame: () => <ComingSoon label="Trivia" />,
  ConfigPanel: () => <ComingSoon label="Trivia" />,
  RoundView: () => <ComingSoon label="Trivia" />,
};
