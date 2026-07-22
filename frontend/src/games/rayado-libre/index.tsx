import { lazy } from "react";
import type { GameDef } from "../gameTypes";

// Juego de dibujo estilo Pictionary con nombre propio (para evitar
// conflictos de marca registrada): un jugador dibuja una palabra secreta y
// el resto adivina escribiendo en el chat antes de que se acabe el tiempo.
const LocalGame = lazy(() => import("./LocalGame").then(m => ({ default: m.LocalGame })));
const ConfigPanel = lazy(() => import("./ConfigPanel").then(m => ({ default: m.ConfigPanel })));
const RoundView = lazy(() => import("./RoundView").then(m => ({ default: m.RoundView })));

export const rayadoLibreGame: GameDef = {
  id: "rayado-libre",
  label: "Rayado Libre",
  icon: "🎨",
  description: "Un jugador dibuja una palabra secreta y el resto del grupo intenta adivinarla escribiendo en el chat antes de que se acabe el tiempo.",
  minPlayers: 3,
  category: "equipos",
  rules: [
    "Por turnos, cada jugador recibe 3 palabras al azar y elige una para dibujar.",
    "Mientras dibuja, el resto escribe sus intentos en el chat.",
    "Cuanto más rápido acertás, más puntos ganás — hay un piso de 60 puntos para los primeros aciertos y después el puntaje baja junto con el tiempo restante.",
    "Quien dibuja también suma puntos fijos por cada jugador que le acierta la palabra.",
    "El juego se juega por vueltas: cada jugador dibuja la misma cantidad de veces.",
  ],
  LocalGame,
  ConfigPanel,
  RoundView,
  tabbedLobby: true,
};
