import { S } from "../../../theme/styles";
import type { Tool } from "./Canvas";

const PALETTE = ["#1a1a1a", "#e2432a", "#2e7dd6", "#2fa85a", "#f2b705", "#a5459b", "#f2872e", "#7a5230", "#ffffff"];
const SIZES = [4, 10, 20];

interface ToolbarProps {
  tool: Tool;
  onChange: (tool: Tool) => void;
  onClear: () => void;
  onUndo: () => void;
}

// Fixed palette (no free color picker) and a handful of stroke sizes — kept
// deliberately small so it fits comfortably on a phone screen above/below
// the board without scrolling.
export function Toolbar({ tool, onChange, onClear, onUndo }: ToolbarProps) {
  return (
    <div style={{ ...S.card, marginTop: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {PALETTE.map(color => (
          <button
            key={color}
            onClick={() => onChange({ ...tool, color })}
            aria-label={`Color ${color}`}
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: color,
              border: tool.color === color ? "3px solid #7F77DD" : "1px solid rgba(255,255,255,0.25)",
              cursor: "pointer",
              padding: 0,
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {SIZES.map(size => (
          <button
            key={size}
            onClick={() => onChange({ ...tool, size })}
            style={{
              ...S.btn(tool.size === size ? "primary" : "ghost"),
              flex: 1,
              padding: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ width: size, height: size, borderRadius: "50%", background: "currentColor" }} />
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onChange({ ...tool, mode: "draw" })}
          style={{ ...S.btn(tool.mode === "draw" ? "primary" : "ghost"), flex: 1, padding: "10px", fontSize: 13 }}
        >
          ✏️ Lápiz
        </button>
        <button
          onClick={() => onChange({ ...tool, mode: "erase" })}
          style={{ ...S.btn(tool.mode === "erase" ? "primary" : "ghost"), flex: 1, padding: "10px", fontSize: 13 }}
        >
          🧼 Goma
        </button>
        <button
          onClick={() => onChange({ ...tool, mode: "fill" })}
          style={{ ...S.btn(tool.mode === "fill" ? "primary" : "ghost"), flex: 1, padding: "10px", fontSize: 13 }}
        >
          🪣 Balde
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={onUndo} style={{ ...S.btn("ghost"), flex: 1, padding: "10px", fontSize: 13 }}>
          ↩️ Deshacer
        </button>
        <button onClick={onClear} style={{ ...S.btn("danger"), flex: 1, padding: "10px", fontSize: 13 }}>
          🗑️ Limpiar
        </button>
      </div>
    </div>
  );
}
