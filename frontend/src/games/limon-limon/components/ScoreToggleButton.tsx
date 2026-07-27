import { S } from "../../../theme/styles";

// Shared by both local modes (circle and reveal) — same full-width "Ver
// puntaje" / "Ocultar puntaje" toggle, so the ranking panel below it opens
// and closes the same way regardless of which mode is running.
export function ScoreToggleButton({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <div style={{ marginTop: 14, marginBottom: 14 }}>
      <button onClick={onToggle} style={{ ...S.btn("ghost"), width: "100%", fontSize: 13 }}>
        {show ? "Ocultar puntaje" : "Ver puntaje"}
      </button>
    </div>
  );
}
