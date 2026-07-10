import { LocalGame } from "./LocalGame";
import { ConfigPanel } from "./ConfigPanel";
import { RoundView } from "./RoundView";

// Bracket/fixture organizer for FIFA sessions between friends: sorteo de
// equipos (ruleta aleatoria o manual) + eliminación directa con goles
// opcionales. Modo local (un dispositivo) y modo online (cada uno desde su
// celular, viendo los cruces y resultados en vivo).
export const torneoFifaGame = {
  id: "torneo-fifa",
  label: "Torneo FIFA",
  icon: "🏆",
  description: "Armá un torneo de FIFA entre amigos: sorteo de equipos, eliminación directa y estadísticas de goles.",
  minPlayers: 2,
  LocalGame,
  ConfigPanel,
  RoundView,
};
