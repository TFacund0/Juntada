import type { CSSProperties } from "react";
import { S } from "../theme/styles";

/**
 * Switcher de tabs segmentado y chico — mismo look/comportamiento en todo
 * lugar donde se usa (Jugadores/Configuración del lobby online, Categorías/
 * Reglas/Orden del `ConfigPanel` online, el espejo de ambos en modo local)
 * así un cambio acá no hay que repetirlo en cada lugar.
 */
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
