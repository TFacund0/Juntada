import { lazy } from "react";
import type { GameDef } from "../gameTypes";

// Dynamic import() creates its own chunk even though this metadata object is
// imported eagerly by the registry — this keeps every game's actual code out
// of the initial bundle until the player picks that game (see registry.js).
const LocalGame = lazy(() => import("./LocalGame").then(m => ({ default: m.LocalGame })));
const ConfigPanel = lazy(() => import("./components/ConfigPanel").then(m => ({ default: m.ConfigPanel })));
const RoundView = lazy(() => import("./RoundView").then(m => ({ default: m.RoundView })));
const LobbyInfo = lazy(() => import("./components/LobbyInfo").then(m => ({ default: m.LobbyInfo })));

// Bracket/fixture organizer for fútbol sessions between friends: sorteo de
// equipos (ruleta aleatoria o manual) + eliminación directa con goles
// opcionales. Modo local (un dispositivo) y modo online (cada uno desde su
// celular, viendo los cruces y resultados en vivo).
export const torneoFutbolGame: GameDef = {
  id: "torneo-futbol",
  label: "Torneo de Fútbol",
  icon: "🏆",
  description: "Armá un torneo de fútbol entre amigos: sorteo de equipos, eliminación directa y estadísticas de goles.",
  minPlayers: 2,
  category: "equipos",
  maintenance: false,
  tabbedLobby: true,
  // Mirrors startRound's own gates (engine.ts) so the lobby shows why
  // "Iniciar ronda" is disabled instead of the host only finding out after
  // tapping it and getting an error banner back.
  canStart: room => {
    const config = room.config as { assignments?: Record<string, string>; teams?: string[] };
    const assignments = config.assignments ?? {};
    const teams = config.teams ?? [];
    if (room.players.some(p => !assignments[p.id])) return "Asigná un equipo a cada jugador antes de iniciar";
    if (teams.length < room.players.length) return "Necesitás al menos un equipo por jugador";
    return null;
  },
  rules: [
    "Cada jugador queda asignado a un equipo (sorteado con una ruleta o elegido a mano) antes de arrancar.",
    'Se arma un cuadro de eliminación directa: si la cantidad de jugadores no es una potencia de 2, algunos pasan directo a la siguiente ronda ("bye").',
    "Los cruces se pueden reordenar antes de iniciar el torneo.",
    'Cada partido se resuelve cargando el resultado: goles de cada lado (si se activó "contabilizar goles") o directamente quién ganó.',
    "El ganador de cada cruce avanza a la siguiente ronda hasta que quede un solo campeón.",
    "Si se contabilizan goles, al final se muestra una tabla con goleador y valla menos vencida del torneo.",
  ],
  LocalGame,
  ConfigPanel,
  RoundView,
  LobbyInfo,
};
