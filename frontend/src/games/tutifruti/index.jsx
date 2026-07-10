import { ComingSoon } from "../../components/ComingSoon";

// Tutifrutti / Stop / Basta: se sortea una letra y todos completan a
// contrarreloj una lista de categorías (país, animal, color, ...) con una
// palabra que empiece con esa letra. Puntúan las respuestas válidas y no
// repetidas entre jugadores. Menu entry only for now — see ComingSoon.
export const tutifrutiGame = {
  id: "tutifruti",
  label: "Tutifrutti",
  icon: "🍉",
  description: "Sale una letra al azar y todos completan categorías (país, animal, color...) con una palabra que empiece con esa letra, contrarreloj.",
  minPlayers: 2,
  comingSoon: true,
  rules: [
    "Se sortea una letra al azar.",
    "Todos completan, a contrarreloj, una lista de categorías (país, animal, color, comida, etc.) con una palabra que empiece con esa letra.",
    "Al terminar el tiempo, se comparan las respuestas: puntúan las válidas, y valen más las que nadie más puso igual.",
  ],
  LocalGame: () => <ComingSoon label="Tutifrutti" />,
  ConfigPanel: () => <ComingSoon label="Tutifrutti" />,
  RoundView: () => <ComingSoon label="Tutifrutti" />,
};
