import { ComingSoon } from "../../components/ComingSoon";
import type { GameDef } from "../gameTypes";

// Se lanza una pregunta tipo "¿quién es más probable que...?" y cada
// jugador vota en secreto por la persona del grupo que mejor encaje; se
// revelan los votos juntos. Menu entry only for now — see ComingSoon.
export const masProbableGame: GameDef = {
  id: "mas-probable",
  label: "¿Quién es Más Probable Que...?",
  icon: "🤔",
  description:
    "Aparece una pregunta como '¿quién es más probable que llegue tarde a todo?' y todos votan en secreto por alguien del grupo.",
  minPlayers: 3,
  category: "grupo",
  comingSoon: true,
  rules: [
    "Se muestra una pregunta del tipo '¿quién es más probable que...?'.",
    "Cada jugador vota en secreto por la persona del grupo que crea que encaja mejor.",
    "Se revelan todos los votos al mismo tiempo.",
    "Se pasa a la siguiente pregunta.",
  ],
  LocalGame: () => <ComingSoon label="¿Quién es Más Probable Que...?" />,
  ConfigPanel: () => <ComingSoon label="¿Quién es Más Probable Que...?" />,
  RoundView: () => <ComingSoon label="¿Quién es Más Probable Que...?" />,
};
