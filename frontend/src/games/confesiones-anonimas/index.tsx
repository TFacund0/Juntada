import { ComingSoon } from "../../components/ComingSoon";
import type { GameDef } from "../gameTypes";

// Los jugadores envían confesiones o secretos de forma anónima y el grupo
// intenta adivinar de quién es cada una. Menu entry only for now — see
// ComingSoon.
export const confesionesAnonimasGame: GameDef = {
  id: "confesiones-anonimas",
  label: "Confesiones Anónimas",
  icon: "🤫",
  description: "Cada jugador escribe una confesión anónima y el grupo intenta adivinar de quién es cada una.",
  minPlayers: 3,
  category: "grupo",
  comingSoon: true,
  rules: [
    "Cada jugador escribe una confesión o secreto de forma anónima.",
    "Se muestran las confesiones una por una, sin decir quién la escribió.",
    "El grupo vota quién creen que la escribió.",
    "Se revela al autor y se suman puntos a quienes acertaron.",
  ],
  LocalGame: () => <ComingSoon label="Confesiones Anónimas" />,
  ConfigPanel: () => <ComingSoon label="Confesiones Anónimas" />,
  RoundView: () => <ComingSoon label="Confesiones Anónimas" />,
};
