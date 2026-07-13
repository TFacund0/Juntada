import { ComingSoon } from "../../components/ComingSoon";
import type { GameDef } from "../gameTypes";

// Se arranca una historia con una frase inicial y cada jugador va
// agregando una línea por turno, construyendo un relato disparatado en
// grupo. Menu entry only for now — see ComingSoon.
export const terminaHistoriaGame: GameDef = {
  id: "termina-historia",
  label: "Termina la Historia",
  icon: "📖",
  description: "Arranca una historia con una frase y cada jugador suma una línea por turno, armando entre todos un relato cada vez más disparatado.",
  minPlayers: 2,
  category: "grupo",
  comingSoon: true,
  rules: [
    "Se arranca la historia con una frase inicial (al azar o elegida por el grupo).",
    "Por turnos, cada jugador agrega una nueva línea continuando la historia.",
    "El relato sigue creciendo hasta completar la cantidad de rondas definida.",
    "Al final se lee la historia completa armada entre todos.",
  ],
  LocalGame: () => <ComingSoon label="Termina la Historia" />,
  ConfigPanel: () => <ComingSoon label="Termina la Historia" />,
  RoundView: () => <ComingSoon label="Termina la Historia" />,
};
