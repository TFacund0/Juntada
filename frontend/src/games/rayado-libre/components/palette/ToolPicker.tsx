import type { ToolMode } from "../../utils/palette";
import { SEGMENT, segmentButton } from "./segment";

const TOOLS: { mode: ToolMode; icon: string; label: string; key: string }[] = [
  { mode: "draw", icon: "✏️", label: "Lápiz", key: "B" },
  { mode: "erase", icon: "🧽", label: "Goma", key: "E" },
  { mode: "fill", icon: "🪣", label: "Balde", key: "G" },
];

interface ToolPickerProps {
  mode: ToolMode;
  onSelect: (mode: ToolMode) => void;
}

/** Lápiz / Goma / Balde: con etiqueta de texto en compu, solo el ícono en celular. */
export function ToolPicker({ mode, onSelect }: ToolPickerProps) {
  return (
    <div role="radiogroup" aria-label="Herramienta" className={SEGMENT}>
      {TOOLS.map(t => (
        <button
          key={t.mode}
          type="button"
          role="radio"
          aria-checked={t.mode === mode}
          aria-label={t.label}
          title={`${t.label} (${t.key})`}
          onClick={() => onSelect(t.mode)}
          className={segmentButton(t.mode === mode)}
        >
          <span aria-hidden="true">{t.icon}</span>
          <span aria-hidden="true" className="hidden @min-[1000px]:inline landscape-short:hidden">
            {t.label}
          </span>
        </button>
      ))}
    </div>
  );
}
