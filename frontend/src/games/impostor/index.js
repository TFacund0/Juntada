import { LocalGame } from "./LocalGame";
import { ConfigPanel } from "./ConfigPanel";
import { RoundView } from "./RoundView";

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
