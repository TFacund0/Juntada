import { S } from "../../theme/styles";
import type { ConfigPanelProps } from "../gameTypes";

// Host-only rules editor shown in the multiplayer lobby: whether the game
// keeps going indefinitely (rotating psychic each round) or ends after a
// fixed number of rounds, showing a winner and letting the host start fresh.
export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const config = room.config as any;
  const playMode = config.playMode || "endless";
  const roundLimit = config.roundLimit || 5;

  return (
    <div style={S.card}>
      <span style={S.label}>¿Cómo se juega?</span>
      <p style={{ ...S.muted, margin: "0 0 10px", lineHeight: 1.4 }}>
        Define cuándo termina la partida: sigue rotando de psíquico ronda tras ronda sin parar, o corta después de una
        cantidad fija de rondas y muestra quién ganó.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: playMode === "rounds" ? 14 : 0 }}>
        <button
          onClick={() => updateConfig({ playMode: "endless" })}
          style={{ ...S.btn(playMode === "endless" ? "primary" : "ghost"), flex: 1, padding: "8px", fontSize: 13 }}
        >
          Libre (sin límite)
        </button>
        <button
          onClick={() => updateConfig({ playMode: "rounds" })}
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
            onChange={e => updateConfig({ roundLimit: +e.target.value })}
            style={{ width: "100%" }}
          />
        </div>
      )}
    </div>
  );
}
