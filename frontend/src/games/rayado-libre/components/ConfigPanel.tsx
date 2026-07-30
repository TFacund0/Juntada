import { S } from "../../../theme/styles";
import type { ConfigPanelProps } from "../../gameTypes";
import { CategoryPicker } from "./CategoryPicker";
import { RoundsPicker } from "./RoundsPicker";

export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const config = room.config as { enabledCategories?: Record<string, boolean>; totalRounds?: number };
  const enabledCategories = config.enabledCategories ?? {};
  const activeCount = Object.values(enabledCategories).filter(Boolean).length;

  return (
    <div>
      <div style={S.card}>
        <CategoryPicker
          enabled={enabledCategories}
          onChange={next => updateConfig({ enabledCategories: next })}
          description="Palabras de qué categorías se ofrecen para dibujar."
        />
        <p style={{ ...S.muted, marginTop: 14 }}>
          {activeCount === 0
            ? "No elegiste ninguna categoría todavía."
            : `${activeCount} categoría${activeCount === 1 ? "" : "s"} activa${activeCount === 1 ? "" : "s"}.`}
        </p>
      </div>

      <RoundsPicker value={config.totalRounds ?? 3} onChange={n => updateConfig({ totalRounds: n })} />
    </div>
  );
}
