import { shuffle } from "../../utils/shuffle";

// Mazo de baraja española usado para el truco: 40 cartas, 4 palos, sin 8 ni 9.
// Colores tradicionales de impresión de cada palo (naipes Fournier/criollos).
export const SUITS = [
  { id: "oro", label: "Oro", color: "#C9972A" },
  { id: "copa", label: "Copa", color: "#B33A3A" },
  { id: "espada", label: "Espada", color: "#2B3A67" },
  { id: "basto", label: "Basto", color: "#3F6B35" },
];

export const VALUES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

// Cada carta (número + palo) es una combinación distinta, así que el
// significado se guarda por carta puntual — pero las reglas son las mismas
// en los 4 palos, con una sola excepción: el 1 de oro duplica el castigo,
// mientras que el 1 de copa/espada/basto es un castigo simple.
const BASE_DESCRIPTIONS = {
  1: "Te la comés vos mismo.",
  2: "Come la carta el jugador a la derecha de quien la reveló.",
  3: "Quien reveló la carta elige quién se la come.",
  4: "Cuenten cuatro jugadores a la derecha empezando por quien reveló (que cuenta como el primero): el cuarto se la come.",
  5: "Elijan un tema (por ejemplo, selecciones de fútbol) y vayan diciendo uno por turno; quien se traba o repite, se come la carta.",
  6: "Juego del limón: quien reveló dice \"un limón, medio limón, tres limones\" y el turno salta a la tercera persona a la derecha. Desde ahí, cada uno suma uno a la frase (\"tres limones, medio limón, cuatro limones\", después \"cuatro... cinco\", etc.) pasando siempre hacia la derecha. Quien se traba, se come la carta.",
  7: "Todos se tocan la nariz a la vez — el último en tocársela se come la carta.",
  10: "Elijan un tema nuevo y vayan diciendo uno por turno, como en el 5; quien se traba, se come la carta.",
  11: "Palito: quien reveló dice \"palito\", el de la derecha \"palito, palito\", el siguiente \"palito, palito, palito\", sumando uno cada vez. Quien se confunde, se come la carta.",
  12: "Se repite el juego del limón (como en el 6): arranca en \"un limón, medio limón, tres limones\" y sigue sumando de a uno hacia la derecha. Quien se traba, se come la carta.",
};

const ORO_OVERRIDES = {
  1: "Te la comés vos mismo, pero el castigo se cumple doble.",
};

export function cardKey(suit, value) {
  return `${suit}-${value}`;
}

export function buildDefaultDescriptions() {
  const result = {};
  for (const suit of SUITS) for (const value of VALUES) {
    result[cardKey(suit.id, value)] = (suit.id === "oro" && ORO_OVERRIDES[value]) || BASE_DESCRIPTIONS[value];
  }
  return result;
}

export function getDescription(descriptions, card) {
  if (!card) return "";
  const value = descriptions?.[cardKey(card.suit, card.value)];
  return typeof value === "string" ? value : "";
}

export function suitInfo(suitId) {
  return SUITS.find(s => s.id === suitId);
}

export function valueLabel(value) {
  if (value === 10) return "Sota";
  if (value === 11) return "Caballo";
  if (value === 12) return "Rey";
  return String(value);
}

export function buildDeck() {
  const deck = [];
  for (const suit of SUITS) for (const value of VALUES) deck.push({ suit: suit.id, value });
  return shuffle(deck);
}

// El orden de turno guardado (room.config.turnOrder) respeta lo que haya
// definido el anfitrión, pero agrega al final a cualquier jugador que no
// figure ahí (recién unido) y descarta ids que ya no están en la sala.
export function effectiveOrder(players, turnOrder) {
  const ids = players.map(p => p.id);
  const stored = (turnOrder || []).filter(id => ids.includes(id));
  const missing = ids.filter(id => !stored.includes(id));
  return [...stored, ...missing];
}
