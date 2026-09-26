// Tabla del turno (pantalla de revelación): de dónde salió cada puntaje, en
// qué orden entran las filas y cuánto se corre cada una al reordenarse —
// como `revealScreen` en docs/referencias/rayado-libre-referencia-v2.html.
// Lo comparten el modo online y el local; los ids llegan como string.

export interface TurnScoreInput {
  players: readonly { id: string; name: string }[];
  drawerId: string | null;
  /** Lo ganado este turno por cada uno (adivinadores + los +10 por acierto de quien dibujó). */
  roundPoints: Readonly<Record<string, number>>;
  /** Segundos que quedaban cuando acertó cada uno (ver `guessSeconds` en el motor). */
  guessSeconds?: Readonly<Record<string, number>>;
  /** Puntaje acumulado DESPUÉS del turno (ya incluye `roundPoints`). */
  totals: Readonly<Record<string, number>>;
  myId?: string;
}

export interface TurnScoreRow {
  id: string;
  name: string;
  isDrawer: boolean;
  isMe: boolean;
  /** Lo ganado este turno. */
  plus: number;
  /** El motivo, en gris debajo del nombre. */
  why: string;
  before: number;
  after: number;
}

/** "adivinó con 57s", "+10 por cada acierto", "nadie adivinó" o "no adivinó". */
export function scoreReason(isDrawer: boolean, plus: number, seconds: number | undefined): string {
  if (isDrawer) return plus > 0 ? "+10 por cada acierto" : "nadie adivinó";
  if (seconds != null) return `adivinó con ${seconds}s`;
  // Un servidor viejo (sin `guessSeconds`) igual deja ver que acertó.
  return plus > 0 ? "adivinó" : "no adivinó";
}

// Orden estable: a igual puntaje se respeta el orden de la sala.
const byDesc = <T>(list: readonly T[], value: (item: T) => number): T[] =>
  list
    .map((item, i) => ({ item, i }))
    .sort((a, b) => value(b.item) - value(a.item) || a.i - b.i)
    .map(x => x.item);

/** Las filas del turno, ordenadas por el puntaje que cada uno tenía ANTES del turno (así entran). */
export function buildTurnScoreRows({ players, drawerId, roundPoints, guessSeconds = {}, totals, myId }: TurnScoreInput): TurnScoreRow[] {
  const rows = players.map(p => {
    const plus = roundPoints[p.id] ?? 0;
    const after = totals[p.id] ?? 0;
    const isDrawer = p.id === drawerId;
    return {
      id: p.id,
      name: p.name,
      isDrawer,
      isMe: p.id === myId,
      plus,
      why: scoreReason(isDrawer, plus, guessSeconds[p.id]),
      before: after - plus,
      after,
    };
  });
  return byDesc(rows, r => r.before);
}

/** El mismo listado ordenado por el total DESPUÉS del turno (a donde se reordena la tabla). */
export function sortByTotal(rows: readonly TurnScoreRow[]): TurnScoreRow[] {
  return byDesc(rows, r => r.after);
}

/** Valor intermedio del conteo: `from` → `to` con ease-out cúbico, `t` de 0 a 1 (countUp de la referencia). */
export function countUpValue(from: number, to: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
}

/** Lo que muestra una fila de la tabla en un momento del conteo. */
export interface RowValues {
  plus: number;
  total: number;
}

/** Duración de cada tramo del conteo (primero el "+N", después el total). */
export const COUNT_MS = 600;

/**
 * Un cuadro del conteo de la tabla, a `elapsed` ms de arrancar: el "+N" de
 * cada fila cuenta desde 0 en el primer tramo y el total, desde el de antes
 * del turno, en el segundo. `done` cuando los dos tramos terminaron.
 */
export function countFrame(rows: readonly TurnScoreRow[], elapsed: number): { values: Record<string, RowValues>; done: boolean } {
  const values: Record<string, RowValues> = {};
  for (const r of rows) {
    values[r.id] = {
      plus: countUpValue(0, r.plus, elapsed / COUNT_MS),
      total: elapsed < COUNT_MS ? r.before : countUpValue(r.before, r.after, (elapsed - COUNT_MS) / COUNT_MS),
    };
  }
  return { values, done: elapsed >= 2 * COUNT_MS };
}

/**
 * FLIP: cuánto hay que correr cada fila (en px) para que arranque desde
 * donde estaba antes de reordenarse. Solo las que se movieron.
 */
export function flipOffsets(before: ReadonlyMap<string, number>, after: ReadonlyMap<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, top] of after) {
    const prev = before.get(id);
    if (prev != null && prev !== top) out.set(id, prev - top);
  }
  return out;
}
