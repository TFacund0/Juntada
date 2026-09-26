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

// La paleta es su propio contenedor (`@container/palette`): en compu su
// ancho sale del alto de la pantalla (el del tablero), así que lo que entra
// en la segunda fila depende de ella y no del ancho de DrawingStage
// (`/stage`). Anchos de contenido que necesita esa fila (medidos: grosor
// 118 + herramienta 118 o 218 con texto + Deshacer 40 + Borrar 40, o ~71
// con "¿Borrar?", + 4 huecos de 6):
// - con Lápiz/Goma/Balde en texto: 440 (471 armada) -> texto desde 472px;
// - solo íconos: 340 (371 armada) -> en una fila desde 372px;
// - debajo de 372px la fila se parte en dos (grosor + herramienta arriba,
//   Deshacer/Borrar abajo a la derecha, 242px como mucho por línea) y se
//   esconde la línea de atajos para no sumar alto.
// Nada de esto en celular (<700px) ni en celular horizontal (ahí la paleta
// no es contenedor: su columna `auto` se mide por su contenido).
const ROW2_WRAP = "@min-[700px]/stage:@max-[372px]/palette:flex-wrap @min-[700px]/stage:@max-[372px]/palette:gap-y-0";
const SPACER_WRAP = "@min-[700px]/stage:@max-[372px]/palette:h-[6px] @min-[700px]/stage:@max-[372px]/palette:basis-full";

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
        "@container/palette mt-[10px] flex flex-col gap-2 rounded-[18px] border border-rl-card-border bg-rl-surface px-[10px] pb-[9px] pt-[10px]",
        "@max-[360px]/stage:px-[7px] @max-[360px]/stage:py-2",
        "@min-[1000px]/stage:mx-auto @min-[1000px]/stage:mt-3 @min-[1000px]/stage:w-[min(100%,calc(100dvh-300px-var(--rl-chrome-offset)))]",
        "landscape-short:[container-type:normal] landscape-short:col-start-1 landscape-short:row-start-2 landscape-short:m-0 landscape-short:flex-row landscape-short:gap-[6px] landscape-short:self-start landscape-short:p-[6px]",
        "short-screen:gap-[6px] short-screen:p-2",
      )}
    >
      <ColorCaps color={tool.color} onSelect={selectColor} bounce={bounce} />
      <div
        className={clsx(
          "flex items-center gap-[6px] @max-[360px]/stage:gap-1 landscape-short:flex-col landscape-short:items-stretch landscape-short:gap-[5px]",
          ROW2_WRAP,
        )}
      >
        <SizePicker size={tool.size} dotColor={tool.mode === "erase" ? "#fff" : tool.color} onSelect={selectSize} />
        <ToolPicker mode={tool.mode} onSelect={selectMode} />
        <span className={clsx("flex-1 landscape-short:hidden", SPACER_WRAP)} />
        <PaletteActions hasDrawing={hasDrawing} onUndo={undo} onArmClear={() => sfx.play("click")} onClear={onClear} />
      </div>
      <ShortcutsHint />
    </div>
  );
}
