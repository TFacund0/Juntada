import { S } from "../../../theme/styles";

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
    <div style={S.card}>
      <span style={S.label}>
        Vueltas: cada jugador dibuja {value} {value === 1 ? "vez" : "veces"}
      </span>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            style={{ ...S.btn(value === n ? "primary" : "ghost"), flex: 1, padding: "8px", fontSize: 13 }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
