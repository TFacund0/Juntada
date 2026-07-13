import { ComingSoon } from "../../components/ComingSoon";
import type { GameDef } from "../gameTypes";

// Se muestra una secuencia de emojis que representa una película y los
// jugadores compiten por adivinar el título antes que el resto. Menu entry
// only for now — see ComingSoon.
export const emojiPeliculaGame: GameDef = {
  id: "emoji-pelicula",
  label: "Película en Emojis",
  icon: "🎬",
  description: "Una secuencia de emojis representa una película famosa. El primero en adivinar el título suma puntos.",
  minPlayers: 2,
  category: "rapidos",
  comingSoon: true,
  rules: [
    "Se muestra una serie de emojis que representan el título o la trama de una película.",
    "Todos intentan adivinar de qué película se trata.",
    "El primero en acertar suma puntos.",
    "Se pasa a la siguiente ronda con una nueva combinación de emojis.",
  ],
  LocalGame: () => <ComingSoon label="Película en Emojis" />,
  ConfigPanel: () => <ComingSoon label="Película en Emojis" />,
  RoundView: () => <ComingSoon label="Película en Emojis" />,
};
