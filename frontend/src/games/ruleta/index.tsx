import { lazy } from "react";
import type { GameDef } from "../gameTypes";

// Dynamic import() creates its own chunk even though this metadata object is
// imported eagerly by the registry — this keeps every game's actual code out
// of the initial bundle until the player picks that game (see registry.js).
const LocalGame = lazy(() => import("./LocalGame").then(m => ({ default: m.LocalGame })));

// A configurable spinner: the group loads whatever options they want
// ("quién arranca", "qué comemos", prendas/consecuencias con descripción, etc.)
// y gira una ruleta real. Modo eliminación (la que sale se saca) o modo
// repetir (se mantienen todas y se gira cuantas veces se quiera).
export const ruletaGame: GameDef = {
  id: "ruleta",
  label: "Ruleta",
  icon: "🎡",
  description: "Cargá las opciones que quieras y girala para que el grupo decida algo al azar.",
  minPlayers: 1,
  localOnly: true,
  rules: [
    "Cargá entradas: un nombre (una persona, una comida, lo que sea) y, opcionalmente, una descripción más larga como un castigo o prenda.",
    "Elegí el modo antes de girar:",
    "- Repetir: se mantienen todas las entradas y podés girar las veces que quieras. Hay un panel para ver cuántas veces salió cada opción.",
    "- Eliminación: la entrada que sale se saca de la ruleta, hasta que quede una sola.",
    "Girá la ruleta y esperá a que frene — el resultado queda destacado con su descripción, si tiene.",
  ],
  LocalGame,
  ConfigPanel: () => null,
  RoundView: () => null,
};
