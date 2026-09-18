import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import type { ConfigPanelProps } from "../../gameTypes";
import { CategoryPicker } from "./CategoryPicker";
import { RoundsPicker } from "./RoundsPicker";
import { CustomWordsEditor } from "./CustomWordsEditor";

export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const config = room.config as { enabledCategories?: Record<string, boolean>; totalRounds?: number; customWords?: string[] };
  const enabledCategories = config.enabledCategories ?? {};
  const activeCount = Object.values(enabledCategories).filter(Boolean).length;
  const customWords = config.customWords ?? [];

  return (
    <div>
      <div className={T.card}>
        <CategoryPicker
          enabled={enabledCategories}
          onChange={next => updateConfig({ enabledCategories: next })}
          description="Palabras de qué categorías se ofrecen para dibujar."
        />
        <p className={clsx(T.muted, "mt-3.5")}>
          {activeCount === 0
            ? "No elegiste ninguna categoría todavía."
            : `${activeCount} categoría${activeCount === 1 ? "" : "s"} activa${activeCount === 1 ? "" : "s"}.`}
        </p>
      </div>

      <CustomWordsEditor words={customWords} onChange={next => updateConfig({ customWords: next })} />

      <RoundsPicker value={config.totalRounds ?? 3} onChange={n => updateConfig({ totalRounds: n })} />
    </div>
  );
}
