import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RayadoSfx } from "./useRayadoSfx";
import { countFrame, flipOffsets, sortByTotal, type RowValues, type TurnScoreRow } from "../utils/turnScores";

// Tiempos de `revealScreen` en la referencia, contados desde que arranca la tabla.
const ROW_ENTER_MS = 300;
const ROW_FIRST_DELAY_MS = 300;
const ROW_STAGGER_MS = 90;
const COUNT_START_MS = 900;
const FLIP_MS = 600;
const BUTTON_AFTER_FLIP_MS = 500;
const ROW_ENTER: Keyframe[] = [
  { opacity: 0, transform: "translateX(-24px)" },
  { opacity: 1, transform: "none" },
];

interface SequenceInput {
  rows: readonly TurnScoreRow[];
  animated: boolean;
  /** Cuándo arranca (después de la pincelada de la palabra), en ms desde el montaje. */
  startDelay: number;
  sfx: Pick<RayadoSfx, "play">;
  /** Terminó todo (o no había nada que animar): ya puede aparecer el botón. */
  onDone: () => void;
}

const valuesOf = (rows: readonly TurnScoreRow[], at: (row: TurnScoreRow) => RowValues) =>
  Object.fromEntries(rows.map(r => [r.id, at(r)])) as Record<string, RowValues>;

/**
 * La secuencia de la tabla del turno: las filas entran escalonadas, el "+N"
 * de cada una cuenta desde 0 y después el total desde el de antes (con el
 * tic de conteo), y al final la tabla se reordena por total con FLIP — cada
 * fila se desliza desde donde estaba. Sin animación (ver useMountMotion)
 * todo aparece ya terminado. Si la pestaña se oculta a mitad de camino, se
 * salta al final: al volver se ve el resultado, no el resto de la función.
 */
export function useScoreTableSequence({ rows, animated, startDelay, sfx, onDone }: SequenceInput) {
  const [values, setValues] = useState(() => (animated ? valuesOf(rows, r => ({ plus: 0, total: r.before })) : {}));
  const [sorted, setSorted] = useState(!animated);
  const rowEls = useRef(new Map<string, HTMLDivElement>());
  const topsBefore = useRef<Map<string, number> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const initialRows = useRef(rows);

  const measure = () => new Map([...rowEls.current].map(([id, el]) => [id, el.getBoundingClientRect().top]));

  useEffect(() => {
    if (!animated) {
      onDoneRef.current();
      return;
    }
    const list = initialRows.current;
    list.forEach((r, i) =>
      rowEls.current.get(r.id)?.animate(ROW_ENTER, {
        duration: ROW_ENTER_MS,
        delay: startDelay + ROW_FIRST_DELAY_MS + i * ROW_STAGGER_MS,
        fill: "backwards",
      }),
    );

    let raf = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      onDoneRef.current();
    };
    const reorder = () => {
      topsBefore.current = measure();
      setSorted(true);
      timers.push(setTimeout(finish, FLIP_MS + BUTTON_AFTER_FLIP_MS));
    };
    timers.push(
      setTimeout(() => {
        const t0 = performance.now();
        let last = "";
        const step = (now: number) => {
          const { values: next, done } = countFrame(list, now - t0);
          const signature = JSON.stringify(next);
          if (signature !== last) {
            if (last) sfx.play("count");
            last = signature;
            setValues(next);
          }
          if (!done) raf = requestAnimationFrame(step);
          else reorder();
        };
        raf = requestAnimationFrame(step);
      }, startDelay + COUNT_START_MS),
    );

    const skipToEnd = () => {
      if (document.visibilityState !== "hidden") return;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      rowEls.current.forEach(el => el.getAnimations?.().forEach(a => a.finish()));
      setValues({});
      setSorted(true);
      finish();
    };
    document.addEventListener("visibilitychange", skipToEnd);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", skipToEnd);
    };
    // La secuencia corre una sola vez, con las filas del turno al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FLIP: la fila se mide antes y después de reordenarse, y arranca corrida por la diferencia.
  useLayoutEffect(() => {
    const before = topsBefore.current;
    if (!sorted || !before) return;
    topsBefore.current = null;
    for (const [id, dy] of flipOffsets(before, measure())) {
      rowEls.current.get(id)?.animate?.([{ transform: `translateY(${dy}px)` }, { transform: "none" }], {
        duration: FLIP_MS,
        easing: "cubic-bezier(.5,0,.2,1)",
      });
    }
  }, [sorted]);

  const shown = useMemo(() => (sorted ? sortByTotal(rows) : rows), [rows, sorted]);
  // Sin valor en curso (terminó, o una fila nueva): el final.
  const valueOf = (row: TurnScoreRow): RowValues => values[row.id] ?? { plus: row.plus, total: row.after };
  const bindRow = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) rowEls.current.set(id, el);
      else rowEls.current.delete(id);
    },
    [],
  );

  return { shown, valueOf, bindRow };
}
