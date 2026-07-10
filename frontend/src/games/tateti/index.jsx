import { LocalGame } from "./LocalGame";
import { ConfigPanel } from "./ConfigPanel";
import { RoundView } from "./RoundView";

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
