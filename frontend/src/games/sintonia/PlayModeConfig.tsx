import { S } from "../../theme/styles";

// Shared "¿Cómo se juega?" editor — identical copy/layout in the online
// lobby's ConfigPanel and local mode's setup screen (both just wire it to
// their own way of persisting playMode/roundLimit), so a rules tweak only
// ever has to happen in one place.
export function PlayModeConfig({
  playMode,
  roundLimit,
  onChange,
}: {
  playMode: "endless" | "rounds";
  roundLimit: number;
  onChange: (patch: { playMode?: "endless" | "rounds"; roundLimit?: number }) => void;
}) {
  return (
    <div style={S.card}>
      <span style={S.label}>¿Cómo se juega?</span>
      <p style={{ ...S.muted, margin: "0 0 10px", lineHeight: 1.4 }}>
        Define cuándo termina la partida: sigue rotando de psíquico ronda tras ronda sin parar, o corta después de una
        cantidad fija de rondas y muestra quién ganó.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: playMode === "rounds" ? 14 : 0 }}>
        <button
          onClick={() => onChange({ playMode: "endless" })}
          style={{ ...S.btn(playMode === "endless" ? "primary" : "ghost"), flex: 1, padding: "8px", fontSize: 13 }}
        >
          Libre (sin límite)
        </button>
        <button
          onClick={() => onChange({ playMode: "rounds" })}
          style={{ ...S.btn(playMode === "rounds" ? "primary" : "ghost"), flex: 1, padding: "8px", fontSize: 13 }}
        >
          Por rondas
        </button>
      </div>
      {playMode === "rounds" && (
        <div>
          <span style={S.label}>Cantidad de rondas: {roundLimit}</span>
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            value={roundLimit}
            onChange={e => onChange({ roundLimit: +e.target.value })}
            style={{ width: "100%" }}
          />
        </div>
      )}
    </div>
  );
}
