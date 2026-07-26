import { S } from "../../theme/styles";

export const GUESS_TIMER_OPTIONS = [0, 5, 10, 15, 20];

// "¿Hay límite de tiempo para adivinar?" editor — shared by local mode's own
// setup screen and the online lobby's ConfigPanel (see ConfigPanel.tsx),
// same options and copy in both so the rules read identically regardless of
// how the room is being played. 0 = sin límite.
export function GuessTimerConfig({ guessSeconds, onChange }: { guessSeconds: number; onChange: (seconds: number) => void }) {
  return (
    <div style={S.card}>
      <span style={S.label}>Tiempo para adivinar</span>
      <p style={{ ...S.muted, margin: "0 0 10px", lineHeight: 1.4 }}>
        Una vez que el color desaparece, cuánto tiempo hay para elegir antes de que se confirme lo que esté seleccionado.
      </p>
      <div style={S.segmentedControl}>
        {GUESS_TIMER_OPTIONS.map(secs => (
          <button key={secs} style={secs === guessSeconds ? S.segmentedOptionActive : S.segmentedOption} onClick={() => onChange(secs)}>
            {secs === 0 ? "Sin límite" : `${secs}s`}
          </button>
        ))}
      </div>
    </div>
  );
}
