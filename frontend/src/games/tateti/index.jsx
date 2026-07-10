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
  LocalGame,
  ConfigPanel,
  RoundView,
};
