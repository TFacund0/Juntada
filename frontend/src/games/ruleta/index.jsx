import { LocalGame } from "./LocalGame";

// A configurable spinner: the group loads whatever options they want
// ("quién arranca", "qué comemos", prendas/consecuencias con descripción, etc.)
// y gira una ruleta real. Modo eliminación (la que sale se saca) o modo
// repetir (se mantienen todas y se gira cuantas veces se quiera).
export const ruletaGame = {
  id: "ruleta",
  label: "Ruleta",
  icon: "🎡",
  description: "Cargá las opciones que quieras y girala para que el grupo decida algo al azar.",
  minPlayers: 1,
  localOnly: true,
  LocalGame,
  ConfigPanel: () => null,
  RoundView: () => null,
};
