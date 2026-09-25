// La pista llega como string del mismo largo que la palabra (ver
// computeWordHint en @juntada/rayado-libre-scoring): "_" es una letra
// oculta, los espacios separan palabras y cualquier otro carácter ya está
// revelado.

export type HintCellKind = "letter" | "blank" | "space";

export interface HintCell {
  kind: HintCellKind;
  /** Lo que se muestra en la celda (en mayúscula); "_" para una oculta. */
  char: string;
}

const HIDDEN = "_";

export function hintCells(hint: string): HintCell[] {
  return [...hint].map(ch =>
    ch === " "
      ? { kind: "space", char: " " }
      : ch === HIDDEN
        ? { kind: "blank", char: HIDDEN }
        : { kind: "letter", char: ch.toUpperCase() },
  );
}

/** Cantidad de letras de la palabra (sin contar espacios). */
export function letterCount(hint: string): number {
  return [...hint].filter(ch => ch !== " ").length;
}

/**
 * Índices que estaban ocultos en `prev` y aparecen revelados en `next`.
 * Una pista de otro largo es otra palabra (turno nuevo, "pedir otra
 * palabra"): ahí no hay letras "nuevas" que animar.
 */
export function newlyRevealed(prev: string, next: string): number[] {
  const a = [...prev];
  const b = [...next];
  if (a.length !== b.length) return [];
  const out: number[] = [];
  for (let i = 0; i < b.length; i++) if (a[i] === HIDDEN && b[i] !== HIDDEN) out.push(i);
  return out;
}
