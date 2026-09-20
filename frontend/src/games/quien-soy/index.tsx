import { lazy } from "react";
import type { GameDef } from "../gameTypes";

// A cada jugador se le asigna un personaje o personalidad secreta que solo
// los demás pueden ver; debe adivinar quién es haciendo preguntas de
// sí/no por turnos, con tres intentos para acertar antes de quedar
// eliminado. Las palabras pueden salir de categorías predefinidas o de
// sugerencias escritas y votadas por el propio grupo.
const LocalGame = lazy(() => import("./LocalGame").then(m => ({ default: m.LocalGame })));
const ConfigPanel = lazy(() => import("./components/ConfigPanel").then(m => ({ default: m.ConfigPanel })));
const RoundView = lazy(() => import("./RoundView").then(m => ({ default: m.RoundView })));
const LobbyInfo = lazy(() => import("./components/LobbyInfo").then(m => ({ default: m.LobbyInfo })));

export const quienSoyGame: GameDef = {
  id: "quien-soy",
  label: "¿Quién Soy?",
  icon: "🎭",
  description:
    "A cada jugador se le asigna un personaje secreto que todos ven menos él. Hay que adivinar quién sos haciendo preguntas de sí o no, con tres intentos antes de quedar eliminado.",
  minPlayers: 2,
  category: "palabras",
  tabbedLobby: true,
  rules: [
    "A cada jugador se le asigna una palabra o personaje secreto, visible para todos menos para él.",
    "Las palabras pueden salir de categorías predefinidas, o cada uno le escribe una palabra a otro jugador (al azar) y el grupo vota cuál usar.",
    "Por turnos, cada jugador hace una pregunta de sí/no al grupo, o intenta adivinar quién es.",
    "Hay tres intentos para adivinar — al tercer error, se queda sin puntos.",
    "También se puede rendir en el propio turno, quedando sin puntos.",
    "Gana quien adivine primero — si dos o más aciertan en la misma vuelta de turnos, empatan en el mismo puesto.",
    "La partida termina cuando todos adivinaron, fueron eliminados o se rindieron.",
  ],
  maintenance: true,
  LocalGame,
  ConfigPanel,
  RoundView,
  LobbyInfo,
};
