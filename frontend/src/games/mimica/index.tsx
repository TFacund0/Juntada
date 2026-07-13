import { ComingSoon } from "../../components/ComingSoon";
import type { GameDef } from "../gameTypes";

// Un jugador actúa una palabra o frase secreta sin hablar y el resto debe
// adivinarla antes de que se acabe el tiempo. Menu entry only for now —
// see ComingSoon.
export const mimicaGame: GameDef = {
  id: "mimica",
  label: "Dígalo con Mímica",
  icon: "🤸",
  description: "Un jugador actúa una palabra o frase secreta sin hablar ni hacer sonidos, y el resto tiene que adivinarla antes de que se acabe el tiempo.",
  minPlayers: 3,
  category: "equipos",
  comingSoon: true,
  rules: [
    "En cada ronda, un jugador recibe una palabra o frase secreta para actuar.",
    "No puede hablar ni hacer sonidos, solo usar gestos y movimientos.",
    "El resto intenta adivinar la palabra antes de que se acabe el tiempo.",
    "Quien adivina correctamente (y quien actuó) suman puntos.",
  ],
  LocalGame: () => <ComingSoon label="Dígalo con Mímica" />,
  ConfigPanel: () => <ComingSoon label="Dígalo con Mímica" />,
  RoundView: () => <ComingSoon label="Dígalo con Mímica" />,
};
