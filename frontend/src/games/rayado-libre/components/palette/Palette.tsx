import { useState } from "react";
import clsx from "clsx";
import type { RayadoSfx } from "../../hooks/useRayadoSfx";
import { usePaletteShortcuts } from "../../hooks/usePaletteShortcuts";
import { PALETTE, type Tool, type ToolMode } from "../../utils/palette";
import type { PaletteShortcut } from "../../utils/shortcuts";
import { ColorCaps } from "./ColorCaps";
import { SizePicker } from "./SizePicker";
import { ToolPicker } from "./ToolPicker";
import { PaletteActions } from "./PaletteActions";
import { ShortcutsHint } from "./ShortcutsHint";

interface PaletteProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  /** Hay algo dibujado en la hoja (habilita Deshacer y Borrar). */
  hasDrawing: boolean;
  onUndo: () => void;
  /** "Borrar todo", ya confirmado. */
  onClear: () => void;
  sfx: Pick<RayadoSfx, "play">;
}

/**
 * Paleta de quien dibuja (`.tools` de la referencia): fila de tapitas de
 * color y fila de grosor, herramienta, Deshacer y Borrar, más la línea de
 * atajos en compu. Debajo del tablero; en compu centrada y del ancho del
 * tablero; en celular horizontal, dos columnas al costado del tablero (en
 * el lugar que reserva DrawingStage).
 */
export function Palette({ tool, onToolChange, hasDrawing, onUndo, onClear, sfx }: PaletteProps) {
  const [bounce, setBounce] = useState(0);

  const selectColor = (index: number) => {
    // Tocar un color con la goma activa vuelve al lápiz.
    onToolChange({ ...tool, color: PALETTE[index], mode: tool.mode === "erase" ? "draw" : tool.mode });
    sfx.play("cap");
    setBounce(n => n + 1);
  };
  const selectSize = (size: number) => {
    onToolChange({ ...tool, size });
    sfx.play("click");
  };
  const selectMode = (mode: ToolMode) => {
    onToolChange({ ...tool, mode });
    sfx.play("click");
  };
  const undo = () => {
    if (!hasDrawing) return;
    onUndo();
    sfx.play("card");
  };

  usePaletteShortcuts((action: PaletteShortcut) => {
    if (action.type === "color") selectColor(action.index);
    else if (action.type === "mode") selectMode(action.mode);
    else if (action.type === "size") selectSize(action.size);
    else undo();
  }, tool.size);

  // En compu, del mismo ancho que el tablero (misma fórmula que su --board-max, ver DrawingStage).
  return (
    <div
      className={clsx(
        "mt-[10px] flex flex-col gap-2 rounded-[18px] border border-rl-card-border bg-rl-surface px-[10px] pb-[9px] pt-[10px]",
        "@max-[360px]:px-[7px] @max-[360px]:py-2",
        "@min-[1000px]:mx-auto @min-[1000px]:mt-3 @min-[1000px]:w-[min(100%,calc(100dvh-300px-var(--rl-chrome-offset)))]",
        "landscape-short:col-start-1 landscape-short:row-start-2 landscape-short:m-0 landscape-short:flex-row landscape-short:gap-[6px] landscape-short:self-start landscape-short:p-[6px]",
        "short-screen:gap-[6px] short-screen:p-2",
      )}
    >
      <ColorCaps color={tool.color} onSelect={selectColor} bounce={bounce} />
      <div className="flex items-center gap-[6px] @max-[360px]:gap-1 landscape-short:flex-col landscape-short:items-stretch landscape-short:gap-[5px]">
        <SizePicker size={tool.size} dotColor={tool.mode === "erase" ? "#fff" : tool.color} onSelect={selectSize} />
        <ToolPicker mode={tool.mode} onSelect={selectMode} />
        <span className="flex-1 landscape-short:hidden" />
        <PaletteActions hasDrawing={hasDrawing} onUndo={undo} onArmClear={() => sfx.play("click")} onClear={onClear} />
      </div>
      <ShortcutsHint />
    </div>
  );
}
