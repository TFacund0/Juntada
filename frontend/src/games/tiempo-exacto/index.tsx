import { ComingSoon } from "../../components/ComingSoon";
import type { GameDef } from "../gameTypes";

// Aparece un número aleatorio de segundos objetivo; el jugador debe
// calcular mentalmente el tiempo (sin ver un cronómetro) y tocar la
// pantalla justo cuando cree que se cumplió ese lapso. Menu entry only
// for now — see ComingSoon.
export const tiempoExactoGame: GameDef = {
  id: "tiempo-exacto",
  label: "Tiempo Exacto",
  icon: "⏱️",
  description:
    "Se muestra un tiempo objetivo en segundos y después se oculta el cronómetro. Hay que calcular mentalmente y tocar la pantalla justo cuando creas que pasó ese tiempo.",
  minPlayers: 1,
  category: "rapidos",
  comingSoon: true,
  rules: [
    "Se muestra un número aleatorio de segundos como objetivo (por ejemplo, 7 segundos).",
    "El cronómetro arranca pero se oculta de la vista.",
    "Cada jugador toca la pantalla cuando cree que se cumplió el tiempo objetivo.",
    "Gana quien se acerque más al tiempo exacto.",
  ],
  LocalGame: () => <ComingSoon label="Tiempo Exacto" />,
  ConfigPanel: () => <ComingSoon label="Tiempo Exacto" />,
  RoundView: () => <ComingSoon label="Tiempo Exacto" />,
};
