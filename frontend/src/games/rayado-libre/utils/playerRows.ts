export type PlayerStatus = "drawing" | "guessed" | "typing" | null;

export interface PlayerRow {
  id: string;
  name: string;
  /** Puntaje acumulado de la partida. */
  score: number;
  status: PlayerStatus;
  /** Puntos de este turno (solo tiene sentido con `status === "guessed"`). */
  gained: number;
}

export interface PlayerRowsInput {
  players: readonly { id: string; name: string }[];
  scores: Record<string, number>;
  drawerId: string | null;
  correctGuessers: readonly string[];
  roundPoints: Record<string, number>;
  /** Quiénes están escribiendo ahora (llega en la fase 3; vacío hasta entonces). */
  typingIds?: readonly string[];
}

/**
 * Filas del panel "Jugadores" (compu): ordenadas por puntaje acumulado (de
 * mayor a menor, estable ante empates) con el estado de cada uno en el
 * turno. Dibujar le gana a todo; haber acertado le gana a escribir.
 */
export function buildPlayerRows({ players, scores, drawerId, correctGuessers, roundPoints, typingIds = [] }: PlayerRowsInput): PlayerRow[] {
  return players
    .map((p, index) => {
      const status: PlayerStatus =
        p.id === drawerId ? "drawing" : correctGuessers.includes(p.id) ? "guessed" : typingIds.includes(p.id) ? "typing" : null;
      return { row: { id: p.id, name: p.name, score: scores[p.id] ?? 0, status, gained: roundPoints[p.id] ?? 0 }, index };
    })
    .sort((a, b) => b.row.score - a.row.score || a.index - b.index)
    .map(({ row }) => row);
}
