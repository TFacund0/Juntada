import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import type { Tool } from "./Canvas";

const PALETTE = ["#1a1a1a", "#e2432a", "#2e7dd6", "#2fa85a", "#f2b705", "#a5459b", "#f2872e", "#7a5230", "#ffffff"];
const SIZES = [4, 10, 20];

interface ToolbarProps {
  tool: Tool;
  onChange: (tool: Tool) => void;
  onClear: () => void;
  onUndo: () => void;
  /** Sin el `S.card` propio — para cuando un padre ya lo envuelve junto al
   * canvas en un único tablero (ver DrawingPhaseScreen), en vez de quedar
   * como una tarjeta separada debajo. Default false: el modo local sigue
   * viéndose exactamente igual que antes. */
  bare?: boolean;
}

// Fixed palette (no free color picker) and a handful of stroke sizes — kept
// deliberately small so it fits comfortably on a phone screen above/below
// the board without scrolling.
export function Toolbar({ tool, onChange, onClear, onUndo, bare = false }: ToolbarProps) {
  return (
    <div className={bare ? undefined : clsx(T.card, "mt-2.5")}>
      <div className="flex flex-wrap gap-2 mb-3">
        {PALETTE.map(color => (
          <button
            key={color}
            onClick={() => onChange({ ...tool, color })}
            aria-label={`Color ${color}`}
            className="w-[30px] h-[30px] rounded-full cursor-pointer p-0"
            style={{ background: color, border: tool.color === color ? "3px solid #7F77DD" : "1px solid rgba(255,255,255,0.25)" }}
          />
        ))}
      </div>

      <div className="flex gap-2 mb-3">
        {SIZES.map(size => (
          <button
            key={size}
            onClick={() => onChange({ ...tool, size })}
            className={clsx(T.btn(tool.size === size ? "primary" : "ghost"), "flex-1 p-2 flex items-center justify-center")}
          >
            <span style={{ width: size, height: size }} className="rounded-full bg-current" />
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onChange({ ...tool, mode: "draw" })}
          className={clsx(T.btn(tool.mode === "draw" ? "primary" : "ghost"), "min-w-0 flex-1 truncate p-2.5 text-[13px]")}
        >
          ✏️ Lápiz
        </button>
        <button
          onClick={() => onChange({ ...tool, mode: "erase" })}
          className={clsx(T.btn(tool.mode === "erase" ? "primary" : "ghost"), "min-w-0 flex-1 truncate p-2.5 text-[13px]")}
        >
          🧼 Goma
        </button>
        <button
          onClick={() => onChange({ ...tool, mode: "fill" })}
          className={clsx(T.btn(tool.mode === "fill" ? "primary" : "ghost"), "min-w-0 flex-1 truncate p-2.5 text-[13px]")}
        >
          🪣 Balde
        </button>
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={onUndo} className={clsx(T.btn("ghost"), "min-w-0 flex-1 truncate p-2.5 text-[13px]")}>
          ↩️ Deshacer
        </button>
        <button onClick={onClear} className={clsx(T.btn("danger"), "min-w-0 flex-1 truncate p-2.5 text-[13px]")}>
          🗑️ Limpiar
        </button>
      </div>
    </div>
  );
}
