import { LocalGame } from "./LocalGame";
import { ConfigPanel } from "./ConfigPanel";
import { RoundView } from "./RoundView";

// Card-based game with a Spanish ("truco") deck: in a circle with the deck in
// the middle, players reveal cards one by one in turn order and the group
// decides out loud who eats each card — nothing is assigned automatically,
// only the (editable) meaning of each card value is shown as a reference.
// Players can join anytime, even mid-deck. When the deck runs out, whoever
// has eaten the most cards loses.
export const limonLimonGame = {
  id: "limon-limon",
  label: "Limón Limón",
  icon: "🍋",
  description: "Con un mazo de truco, se revela una carta por turno y el grupo decide quién se la come. El que junta más cartas, pierde.",
  minPlayers: 2,
  rules: [
    "El mazo (baraja española, 40 cartas) queda en el centro de la ronda. Por turnos, alguien lo toca para revelar la carta de arriba.",
    "El grupo decide siempre a mano quién se queda con la carta — el juego nunca asigna nada solo, solo muestra como referencia el significado de esa carta puntual (número + palo) para recordar la regla.",
    "Las 40 cartas comparten las mismas reglas entre los 4 palos, con una sola excepción: el 1 de oro duplica el castigo, mientras que en copa/espada/basto es un castigo simple. Esos significados son editables antes de arrancar.",
    "Se pueden sumar jugadores en cualquier momento, incluso a mitad de partida.",
    "Cualquiera puede votar para terminar la partida antes de vaciar el mazo — con la mitad de los jugadores de acuerdo, se corta ahí mismo y se muestra la tabla tal como está.",
    "Al terminar (por mazo vacío o por votación), gana quien juntó menos cartas.",
  ],
  LocalGame,
  ConfigPanel,
  RoundView,
};
