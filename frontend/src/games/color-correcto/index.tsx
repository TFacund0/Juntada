import { lazy } from "react";
import type { GameDef } from "../gameTypes";

// Aparece un color en pantalla, desaparece, y hay que elegir el más
// parecido posible con el selector de color. El puntaje de cada ronda es
// qué tan cerca quedó el intento (0.00-10.00), estilo dialed.gg. Online:
// todos compiten a la vez sobre el mismo color, con tabla de puntuación en
// vivo. Local: un solo dispositivo, pasándoselo por turnos.
const LocalGame = lazy(() => import("./LocalGame").then(m => ({ default: m.LocalGame })));
const ConfigPanel = lazy(() => import("./ConfigPanel").then(m => ({ default: m.ConfigPanel })));
const RoundView = lazy(() => import("./RoundView").then(m => ({ default: m.RoundView })));

export const colorCorrectoGame: GameDef = {
  id: "color-correcto",
  label: "Encuentra el Color Correcto",
  icon: "🟪",
  description:
    "Aparece un color en pantalla y después desaparece. Hay que elegir con el selector el color más parecido posible a lo que viste — cuanto más cerca, más puntos.",
  minPlayers: 2,
  category: "rapidos",
  rules: [
    "Aparece un color en pantalla durante unos segundos y después desaparece.",
    "Hay que elegir, con el selector, el color más parecido posible al que viste.",
    "Cada intento da un puntaje de 0 a 10 (con decimales) según qué tan cerca quedó del color real.",
    "Online: todos adivinan el mismo color a la vez, cada uno desde su dispositivo, y se revela a todos junto con los puntajes.",
    "La partida puede jugarse sin límite de rondas (tabla de puntuación acumulada) o por una cantidad fija de rondas, con un ganador al final.",
    "Local: se juega en un solo dispositivo pasándolo por turnos — a cada jugador le aparece el mismo color de la ronda y elige su intento antes de pasar al siguiente.",
  ],
  LocalGame,
  ConfigPanel,
  RoundView,
  tabbedLobby: true,
};
