import { ComingSoon } from "../../components/ComingSoon";
import type { GameDef } from "../gameTypes";

// Kahoot-style trivia: multiple-choice questions shown to everyone at once,
// points for correct + fast answers, live ranking between rounds. Menu
// entry only for now — see ComingSoon.
export const triviaGame: GameDef = {
  id: "trivia",
  label: "Trivia",
  icon: "🧠",
  description: "Preguntas de opción múltiple para todos a la vez. Sumás más puntos cuanto más rápido y correcto respondas.",
  minPlayers: 2,
  comingSoon: true,
  rules: [
    "Se muestra una pregunta de opción múltiple a todos al mismo tiempo.",
    "Cada uno responde desde su dispositivo, contra el reloj.",
    "Suman más puntos las respuestas correctas y rápidas.",
    "Entre pregunta y pregunta se muestra el ranking en vivo.",
  ],
  LocalGame: () => <ComingSoon label="Trivia" />,
  ConfigPanel: () => <ComingSoon label="Trivia" />,
  RoundView: () => <ComingSoon label="Trivia" />,
};
