import { ComingSoon } from "../../components/ComingSoon";
import type { GameDef } from "../gameTypes";

// Se muestran frases "yo nunca nunca..." y cada jugador confiesa (o no)
// si las hizo; quien las hizo pierde una vida/toma. Menu entry only for
// now — see ComingSoon.
export const yoNuncaGame: GameDef = {
  id: "yo-nunca",
  label: "Yo Nunca Nunca",
  icon: "🙈",
  description:
    "Aparece una frase 'yo nunca nunca...' y cada jugador confiesa si la hizo o no. Quien la hizo, pierde una vida (o toma, si juegan con bebida).",
  minPlayers: 2,
  category: "grupo",
  comingSoon: true,
  rules: [
    "Se muestra una frase del tipo 'yo nunca nunca hice tal cosa'.",
    "Cada jugador confiesa en privado si la hizo o no.",
    "Quien la hizo pierde una vida (o toma, según cómo lo jueguen).",
    "El último con vidas gana la partida.",
  ],
  LocalGame: () => <ComingSoon label="Yo Nunca Nunca" />,
  ConfigPanel: () => <ComingSoon label="Yo Nunca Nunca" />,
  RoundView: () => <ComingSoon label="Yo Nunca Nunca" />,
};
