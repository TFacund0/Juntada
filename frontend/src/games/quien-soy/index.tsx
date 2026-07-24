import { ComingSoon } from "../../components/ComingSoon";
import type { GameDef } from "../gameTypes";

// A cada jugador se le asigna un personaje o personalidad secreta que solo
// los demás pueden ver; debe adivinar quién es haciendo preguntas de
// sí/no. Menu entry only for now — see ComingSoon.
export const quienSoyGame: GameDef = {
  id: "quien-soy",
  label: "¿Quién Soy?",
  icon: "🎭",
  description:
    "A cada jugador se le asigna un personaje secreto que todos ven menos él. Hay que adivinar quién sos haciendo preguntas de sí o no.",
  minPlayers: 3,
  category: "grupo",
  comingSoon: true,
  rules: [
    "A cada jugador se le asigna un personaje secreto, visible para todos menos para él.",
    "Por turnos, cada uno hace preguntas de sí/no al grupo para descubrir quién es.",
    "Sigue preguntando mientras acierte con respuestas afirmativas; si le dicen que no, pasa el turno.",
    "Gana quien primero adivina su personaje.",
  ],
  LocalGame: () => <ComingSoon label="¿Quién Soy?" />,
  ConfigPanel: () => <ComingSoon label="¿Quién Soy?" />,
  RoundView: () => <ComingSoon label="¿Quién Soy?" />,
};
