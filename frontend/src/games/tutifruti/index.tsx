import { LocalGame } from "./LocalGame";
import { ConfigPanel } from "./ConfigPanel";
import { RoundView } from "./RoundView";
import { LobbyInfo } from "./LobbyInfo";
import type { GameDef } from "../gameTypes";

// Tutifrutti / Stop / Basta: se sortea una letra y todos completan a
// contrarreloj (o hasta que alguien grite "¡Basta!") una lista de categorías
// (país, animal, color, ...) con una palabra que empiece con esa letra. Luego
// entre todos marcan qué respuestas son válidas antes de sumar puntos.
export const tutifrutiGame: GameDef = {
  id: "tutifruti",
  label: "Tutifrutti",
  icon: "🍉",
  description:
    "Sale una letra al azar y todos completan categorías (país, animal, color...) con una palabra que empiece con esa letra, contrarreloj.",
  minPlayers: 2,
  rules: [
    "Se sortea una letra al azar; el anfitrión puede cambiarla antes de arrancar.",
    'Todos completan, a contrarreloj (o hasta que alguien grite "¡Basta!"), una lista de categorías con una palabra que empiece con esa letra.',
    "Al terminar, entre todos marcan con tilde o cruz cada respuesta de los demás.",
    "- Una palabra válida y no repetida vale 10 puntos.",
    "- Una palabra repetida con otro jugador vale la mitad.",
    "- Una palabra con más cruces que tildes no suma puntos.",
    "Se juegan varias rondas (las que configure el anfitrión) y gana quien más puntos acumule.",
  ],
  LocalGame,
  ConfigPanel,
  RoundView,
  LobbyInfo,
};
