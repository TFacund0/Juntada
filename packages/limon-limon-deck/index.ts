// Deck composition and per-card rule text shared between the backend engine
// (source of truth for a real online room) and the frontend LocalGame
// (needs the identical deck/descriptions offline, with no server involved) —
// previously copy-pasted verbatim on both sides, including the long rule
// text, which is exactly the kind of content that drifts silently when only
// one copy gets edited.

export const SUIT_IDS = ["oro", "copa", "espada", "basto"];
export const VALUES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

export interface Card {
  suit: string;
  value: number;
}

// Cada carta (número + palo) es una combinación distinta y puede tener su
// propio significado — pero las reglas son las mismas en los 4 palos, con
// una sola excepción: el 1 de oro duplica el castigo, mientras que el 1 de
// copa/espada/basto es un castigo simple (todas se pueden editar por
// separado desde el ConfigPanel, vía el "update_config" genérico).
const BASE_DESCRIPTIONS: Record<number, string> = {
  1: "Te la comés vos mismo.",
  2: "Come la carta el jugador a la derecha de quien la reveló.",
  3: "Quien reveló la carta elige quién se la come.",
  4: "Cuenten cuatro jugadores a la derecha empezando por quien reveló (que cuenta como el primero): el cuarto se la come.",
  5: "Elijan un tema (por ejemplo, selecciones de fútbol) y vayan diciendo uno por turno; quien se traba o repite, se come la carta.",
  6: 'Juego del limón: quien reveló dice "un limón, medio limón, tres limones" y el turno salta a la tercera persona a la derecha. Desde ahí, cada uno suma uno a la frase ("tres limones, medio limón, cuatro limones", después "cuatro... cinco", etc.) pasando siempre hacia la derecha. Quien se traba, se come la carta.',
  7: "Todos se tocan la nariz a la vez — el último en tocársela se come la carta.",
  10: "Elijan un tema nuevo y vayan diciendo uno por turno, como en el 5; quien se traba, se come la carta.",
  11: 'Palito: quien reveló dice "palito", el de la derecha "palito, palito", el siguiente "palito, palito, palito", sumando uno cada vez. Quien se confunde, se come la carta.',
  12: 'Se repite el juego del limón (como en el 6): arranca en "un limón, medio limón, tres limones" y sigue sumando de a uno hacia la derecha. Quien se traba, se come la carta.',
};

const ORO_OVERRIDES: Record<number, string> = {
  1: "Te la comés vos mismo, pero el castigo se cumple doble.",
};

export function cardKey(suit: string, value: number): string {
  return `${suit}-${value}`;
}

export function buildDefaultDescriptions(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const suit of SUIT_IDS)
    for (const value of VALUES) {
      result[cardKey(suit, value)] = (suit === "oro" && ORO_OVERRIDES[value]) || BASE_DESCRIPTIONS[value];
    }
  return result;
}

export function getDescription(descriptions: Record<string, string> | undefined, card: Card | null): string {
  if (!card) return "";
  const value = descriptions?.[cardKey(card.suit, card.value)];
  return typeof value === "string" ? value : "";
}

// Unshuffled — every consumer already has its own shuffle utility
// (backend/src/utils/shuffle.ts, frontend/src/utils/shuffle.ts), so this
// package doesn't need its own PRNG dependency.
export function orderedDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUIT_IDS) for (const value of VALUES) deck.push({ suit, value });
  return deck;
}
