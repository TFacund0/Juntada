import { lazy } from "react";

// Dynamic import() creates its own chunk even though this metadata object is
// imported eagerly by the registry — this keeps every game's actual code out
// of the initial bundle until the player picks that game (see registry.js).
const LocalGame = lazy(() => import("./LocalGame").then(m => ({ default: m.LocalGame })));
const ConfigPanel = lazy(() => import("./ConfigPanel").then(m => ({ default: m.ConfigPanel })));
const RoundView = lazy(() => import("./RoundView").then(m => ({ default: m.RoundView })));

export const impostorGame = {
  id: "impostor",
  label: "El Impostor",
  icon: "🕵️",
  description: "Todos reciben la misma palabra menos el impostor. Encontralo antes de que se salga con la suya.",
  minPlayers: 3,
  rules: [
    "Todos los jugadores reciben la misma palabra secreta, salvo el (o los) impostor, que no la ve — solo sabe la categoría, si las pistas están activadas.",
    "Por turno, cada uno dice o escribe una pista relacionada con la palabra, sin decirla directamente. El impostor tiene que inventar una pista creíble sin saber cuál es la palabra.",
    "Después de las pistas (y una fase opcional de discusión), todos votan a quién sospechan.",
    "Se elimina al más votado y se revela si era o no el impostor.",
    "- El impostor gana si sobrevive a la votación (o si logra que eliminen a un inocente sin que se note).",
    "- Los inocentes ganan si logran eliminar a todos los impostores.",
    "Configuración disponible: cantidad de impostores, pistas al impostor on/off, tiempo límite para dar pistas, tiempo de discusión y qué categorías de palabras están habilitadas.",
  ],
  LocalGame,
  ConfigPanel,
  RoundView,
};
