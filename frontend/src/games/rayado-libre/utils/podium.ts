import { RAYADO_RAINBOW } from "../rainbow";

// Podio final (`podium` en docs/referencias/rayado-libre-referencia-v2.html):
// 2.º | 1.º | 3.º con barras de 58/82/42 % en azul, violeta y naranja del
// arcoíris. Con 2 jugadores quedan solo 2.º | 1.º; con 4 o más, solo los 3
// primeros.

export interface PodiumEntry {
  id: string;
  name: string;
  score: number;
  isMe?: boolean;
}

export type PodiumPlace = 1 | 2 | 3;

export interface PodiumSlot {
  entry: PodiumEntry;
  place: PodiumPlace;
  /** Alto de la barra, en % del podio. */
  height: number;
  color: string;
}

const HEIGHT: Record<PodiumPlace, number> = { 1: 82, 2: 58, 3: 42 };
const COLOR: Record<PodiumPlace, string> = { 1: RAYADO_RAINBOW[4], 2: RAYADO_RAINBOW[3], 3: RAYADO_RAINBOW[1] };
// De izquierda a derecha.
const LAYOUT: readonly PodiumPlace[] = [2, 1, 3];

/** Por puntaje, de mayor a menor; a igual puntaje se respeta el orden de la sala. */
export function rankEntries(entries: readonly PodiumEntry[]): PodiumEntry[] {
  return entries
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => b.entry.score - a.entry.score || a.i - b.i)
    .map(x => x.entry);
}

/** Las columnas del podio de izquierda a derecha (2.º, 1.º, 3.º — las que haya). */
export function podiumSlots(entries: readonly PodiumEntry[]): PodiumSlot[] {
  const ranked = rankEntries(entries);
  return LAYOUT.filter(place => ranked[place - 1]).map(place => ({
    entry: ranked[place - 1],
    place,
    height: HEIGHT[place],
    color: COLOR[place],
  }));
}

/** En qué orden crecen las barras: 3.º, 2.º y al final 1.º (índices de `podiumSlots`). */
export function podiumRevealOrder(slots: readonly PodiumSlot[]): number[] {
  return slots
    .map((slot, i) => ({ place: slot.place, i }))
    .sort((a, b) => b.place - a.place)
    .map(x => x.i);
}

/** "¡Ganaste!" si el primero soy yo, "Ganó X" si no. */
export function podiumTitle(winner: PodiumEntry | undefined): string {
  if (!winner) return "Podio";
  return winner.isMe ? "¡Ganaste!" : `Ganó ${winner.name}`;
}

/**
 * Alto del área de las barras (el `.podium` de 260px de la referencia). Las
 * barras miden su % de esta área fija; avatar, nombre y puntos van encima
 * sin descontarle altura.
 */
export const BAR_AREA_PX = 260;

/** Alto en px de una barra de `height` % del área. */
export const barHeightPx = (height: number) => Math.round((BAR_AREA_PX * height) / 100);

/** Degradé de la barra: el color arriba, oscureciéndose hacia el fondo. */
export const barBackground = (color: string) => `linear-gradient(${color}, color-mix(in srgb, ${color} 55%, #0f0c1d))`;
