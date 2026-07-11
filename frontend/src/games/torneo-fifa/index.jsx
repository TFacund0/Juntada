import { lazy } from "react";

// Dynamic import() creates its own chunk even though this metadata object is
// imported eagerly by the registry — this keeps every game's actual code out
// of the initial bundle until the player picks that game (see registry.js).
const LocalGame = lazy(() => import("./LocalGame").then(m => ({ default: m.LocalGame })));
const ConfigPanel = lazy(() => import("./ConfigPanel").then(m => ({ default: m.ConfigPanel })));
const RoundView = lazy(() => import("./RoundView").then(m => ({ default: m.RoundView })));

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
  rules: [
    "Cada jugador queda asignado a un equipo (sorteado con una ruleta o elegido a mano) antes de arrancar.",
    "Se arma un cuadro de eliminación directa: si la cantidad de jugadores no es una potencia de 2, algunos pasan directo a la siguiente ronda (\"bye\").",
    "Los cruces se pueden reordenar antes de iniciar el torneo.",
    "Cada partido se resuelve cargando el resultado: goles de cada lado (si se activó \"contabilizar goles\") o directamente quién ganó.",
    "El ganador de cada cruce avanza a la siguiente ronda hasta que quede un solo campeón.",
    "Si se contabilizan goles, al final se muestra una tabla con goleador y valla menos vencida del torneo.",
  ],
  LocalGame,
  ConfigPanel,
  RoundView,
};
