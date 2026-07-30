import type { RoundViewProps } from "../../gameTypes";

/** Extrae el mapa `playerId → puntaje acumulado` guardado en `room.config.score` por el motor online. */
export function roomScore(room: RoundViewProps["room"]): Record<string, number> {
  return ((room.config as { score?: Record<string, number> })?.score ?? {}) as Record<string, number>;
}
