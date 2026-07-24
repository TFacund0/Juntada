import { ComingSoon } from "../../components/ComingSoon";
import type { GameDef } from "../gameTypes";

// Hay un temporizador oculto que puede explotar en cualquier momento; los
// jugadores se van pasando el turno (o "la bomba") y quien la tenga
// cuando explota pierde. Menu entry only for now — see ComingSoon.
export const bombaGame: GameDef = {
  id: "bomba",
  label: "Bomba",
  icon: "💣",
  description:
    "Un temporizador oculto puede explotar en cualquier momento. Los jugadores se van pasando la bomba por turnos, y quien la tenga cuando explota pierde.",
  minPlayers: 3,
  category: "grupo",
  comingSoon: true,
  rules: [
    "Se activa un temporizador oculto que va a explotar en un momento aleatorio dentro de un rango.",
    "Los jugadores se van pasando la bomba por turnos (por ejemplo, cumpliendo una consigna antes de pasarla).",
    "Nadie sabe cuánto tiempo queda hasta que explota.",
    "Quien tiene la bomba en el momento de la explosión pierde esa ronda.",
  ],
  LocalGame: () => <ComingSoon label="Bomba" />,
  ConfigPanel: () => <ComingSoon label="Bomba" />,
  RoundView: () => <ComingSoon label="Bomba" />,
};
