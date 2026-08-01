import { ComingSoon } from "../../components/game-kit/ComingSoon";
import type { GameDef } from "../gameTypes";

// El clásico: cada turno se elige entre responder una verdad incómoda o
// cumplir un reto. Menu entry only for now — see ComingSoon.
export const verdadORetoGame: GameDef = {
  id: "verdad-o-reto",
  label: "Verdad o Reto",
  icon: "🎲",
  description: "El clásico de siempre: en cada turno elegís entre responder una verdad incómoda o cumplir un reto.",
  minPlayers: 2,
  category: "fiesta",
  comingSoon: true,
  rules: [
    "Por turnos, se elige a un jugador (o se sortea).",
    "El jugador elige entre 'verdad' (responder una pregunta con sinceridad) o 'reto' (cumplir un desafío).",
    "El grupo puede proponer la pregunta o el reto, o se sortea de un listado.",
    "Se pasa el turno al siguiente jugador.",
  ],
  LocalGame: () => <ComingSoon label="Verdad o Reto" />,
  ConfigPanel: () => <ComingSoon label="Verdad o Reto" />,
  RoundView: () => <ComingSoon label="Verdad o Reto" />,
};
