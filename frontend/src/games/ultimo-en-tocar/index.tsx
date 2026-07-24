import { ComingSoon } from "../../components/ComingSoon";
import type { GameDef } from "../gameTypes";

// Todos mantienen el dedo en la pantalla; el juego termina en un momento
// aleatorio y quien no llegó a tiempo (o soltó antes) pierde. Menu entry
// only for now — see ComingSoon.
export const ultimoEnTocarGame: GameDef = {
  id: "ultimo-en-tocar",
  label: "Último en Tocar Pierde",
  icon: "🫸",
  description:
    "Todos mantienen el dedo apoyado en la pantalla. En un momento aleatorio el juego termina, y quien no estaba tocando en ese instante pierde.",
  minPlayers: 2,
  category: "rapidos",
  comingSoon: true,
  rules: [
    "Todos los jugadores apoyan el dedo en la pantalla al mismo tiempo.",
    "En un momento aleatorio la ronda termina.",
    "Quien no estaba tocando la pantalla en ese instante (por haber soltado antes) pierde.",
    "Se puede jugar a eliminación o por puntos.",
  ],
  LocalGame: () => <ComingSoon label="Último en Tocar Pierde" />,
  ConfigPanel: () => <ComingSoon label="Último en Tocar Pierde" />,
  RoundView: () => <ComingSoon label="Último en Tocar Pierde" />,
};
