import clsx from "clsx";
import { T } from "../../../theme/styles/classes";

interface RoundsPickerProps {
  value: number;
  onChange: (rounds: number) => void;
}

/**
 * Selector de cantidad de vueltas (cada jugador dibuja `value` veces).
 *
 * Compartido entre el modo local y el modo online — antes era la misma
 * tarjeta duplicada en `LocalGame` y `ConfigPanel`.
 *
 * @param value Vueltas actualmente configuradas.
 * @param onChange Nueva cantidad de vueltas elegida.
 */
export function RoundsPicker({ value, onChange }: RoundsPickerProps) {
  return (
    <div className={T.card}>
      <span className={T.label}>
        Vueltas: cada jugador dibuja {value} {value === 1 ? "vez" : "veces"}
      </span>
      <div className="flex gap-2 mt-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => onChange(n)} className={clsx(T.btn(value === n ? "primary" : "ghost"), "flex-1 p-2 text-[13px]")}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
