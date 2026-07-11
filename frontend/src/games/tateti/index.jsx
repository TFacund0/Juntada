import { lazy } from "react";

// Dynamic import() creates its own chunk even though this metadata object is
// imported eagerly by the registry — this keeps every game's actual code out
// of the initial bundle until the player picks that game (see registry.js).
const LocalGame = lazy(() => import("./LocalGame").then(m => ({ default: m.LocalGame })));
const ConfigPanel = lazy(() => import("./ConfigPanel").then(m => ({ default: m.ConfigPanel })));
const RoundView = lazy(() => import("./RoundView").then(m => ({ default: m.RoundView })));

// Classic 1v1 tic-tac-toe. Modo local (un dispositivo, se lo pasan por
// turnos) y modo online (sala de a dos, cada uno desde su celular) — el
// marcador se mantiene entre revanchas y solo se reinicia si ambos lo piden.
export const tatetiGame = {
  id: "tateti",
  label: "Ta-Te-Ti",
  icon: "⭕",
  description: "El clásico 3 en raya, uno contra uno. Rápido y para picar entre rondas de otros juegos.",
  minPlayers: 2,
  rules: [
    "El clásico 3 en raya, uno contra uno: se turnan para marcar casilleros en un tablero de 3x3.",
    "Gana quien logre alinear sus tres marcas (fila, columna o diagonal) primero. Si se llena el tablero sin que nadie alinee, es empate.",
    "El marcador (victorias de cada uno + empates) se mantiene entre partidas, y quién arranca alterna en cada revancha.",
    "En modo online, tanto la revancha como el reinicio del marcador necesitan que los dos jugadores estén de acuerdo.",
  ],
  LocalGame,
  ConfigPanel,
  RoundView,
};
