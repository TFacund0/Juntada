import { ComingSoon } from "../../components/game-kit/ComingSoon";
import type { GameDef } from "../gameTypes";

// El clásico juego de adivinar una palabra letra por letra antes de
// agotar los intentos, en formato grupal por turnos. Menu entry only for
// now — see ComingSoon.
export const ahorcadoGame: GameDef = {
  id: "ahorcado",
  label: "Ahorcado",
  icon: "🪢",
  description: "El clásico: hay que adivinar una palabra secreta letra por letra antes de agotar los intentos.",
  minPlayers: 2,
  category: "rapidos",
  comingSoon: true,
  rules: [
    "Se elige (o sortea) una palabra o frase secreta.",
    "Por turnos, cada jugador propone una letra.",
    "Si la letra está en la palabra, se revela en todas sus posiciones; si no, se pierde un intento.",
    "El grupo gana si completa la palabra antes de agotar los intentos permitidos.",
  ],
  LocalGame: () => <ComingSoon label="Ahorcado" />,
  ConfigPanel: () => <ComingSoon label="Ahorcado" />,
  RoundView: () => <ComingSoon label="Ahorcado" />,
};
