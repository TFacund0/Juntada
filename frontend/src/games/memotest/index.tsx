import { ComingSoon } from "../../components/ComingSoon";
import type { GameDef } from "../gameTypes";

// Juego de memoria con cartas boca abajo: hay que encontrar las parejas
// iguales en el menor número de intentos, compitiendo contra el resto.
// Menu entry only for now — see ComingSoon.
export const memotestGame: GameDef = {
  id: "memotest",
  label: "Memotest",
  icon: "🧩",
  description:
    "Cartas boca abajo: por turnos, cada uno da vuelta dos cartas buscando encontrar una pareja igual. Gana quien junte más parejas.",
  minPlayers: 2,
  category: "rapidos",
  comingSoon: true,
  rules: [
    "Se reparte un tablero de cartas boca abajo, todas en parejas.",
    "Por turnos, cada jugador da vuelta dos cartas.",
    "Si coinciden, se lleva el par y juega de nuevo; si no, las vuelve a tapar y pasa el turno.",
    "Gana quien junte más parejas cuando se destapa todo el tablero.",
  ],
  LocalGame: () => <ComingSoon label="Memotest" />,
  ConfigPanel: () => <ComingSoon label="Memotest" />,
  RoundView: () => <ComingSoon label="Memotest" />,
};
