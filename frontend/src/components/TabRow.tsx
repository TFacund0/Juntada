import type { CSSProperties } from "react";
import { S } from "../theme/styles";

// Small segmented tab switcher — same look/behavior everywhere it's used
// (online lobby's Jugadores/Configuración, online ConfigPanel's
// Categorías/Reglas/Orden, local mode's mirror of both) so a change here
// doesn't need to be repeated in each spot.
export interface TabDef<T extends string> {
  key: T;
  label: string;
}

interface TabRowProps<T extends string> {
  tabs: TabDef<T>[];
  active: T;
  onChange: (key: T) => void;
  style?: CSSProperties;
  buttonPadding?: string;
}

export function TabRow<T extends string>({ tabs, active, onChange, style, buttonPadding = "10px 4px" }: TabRowProps<T>) {
  return (
    <div style={{ display: "flex", gap: 8, ...style }}>
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{ ...S.btn(active === t.key ? "primary" : "ghost"), flex: 1, padding: buttonPadding, fontSize: 13 }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
