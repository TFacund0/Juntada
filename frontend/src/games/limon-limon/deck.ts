import { shuffle } from "../../utils/shuffle";
import { SUIT_IDS, VALUES, cardKey, buildDefaultDescriptions, getDescription, orderedDeck } from "@juntada/limon-limon-deck";
import type { Card } from "@juntada/limon-limon-deck";

export { VALUES, cardKey, buildDefaultDescriptions, getDescription };
export type { Card };

// Colores tradicionales de impresión de cada palo (naipes Fournier/criollos)
// — puramente de presentación, así que se quedan del lado del frontend en
// vez de ir al paquete compartido (que solo conoce los ids "oro"/"copa"/...).
const SUIT_LABELS: Record<string, { label: string; color: string }> = {
  oro: { label: "Oro", color: "#C9972A" },
  copa: { label: "Copa", color: "#B33A3A" },
  espada: { label: "Espada", color: "#2B3A67" },
  basto: { label: "Basto", color: "#3F6B35" },
};

export const SUITS = SUIT_IDS.map(id => ({ id, ...SUIT_LABELS[id] }));

export function suitInfo(suitId: string) {
  return SUITS.find(s => s.id === suitId)!;
}

export function valueLabel(value: number): string {
  if (value === 10) return "Sota";
  if (value === 11) return "Caballo";
  if (value === 12) return "Rey";
  return String(value);
}

export function buildDeck(): Card[] {
  return shuffle(orderedDeck());
}

// El orden de turno guardado (room.config.turnOrder) respeta lo que haya
// definido el anfitrión, pero agrega al final a cualquier jugador que no
// figure ahí (recién unido) y descarta ids que ya no están en la sala.
export function effectiveOrder(players: { id: string }[], turnOrder: string[] | undefined): string[] {
  const ids = players.map(p => p.id);
  const stored = (turnOrder || []).filter(id => ids.includes(id));
  const missing = ids.filter(id => !stored.includes(id));
  return [...stored, ...missing];
}
