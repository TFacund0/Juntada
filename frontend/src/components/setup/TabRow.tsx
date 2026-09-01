import clsx from "clsx";
import { T } from "../../theme/styles/classes";

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
  className?: string;
  // Los dos únicos paddings de botón que usan los callers hoy — "compact"
  // es el que usan las variantes con contenido debajo en la misma card
  // (ConfigTabs/ConfigPanel), el default es el de SetupTabs/LocalGame.
  compact?: boolean;
}

export function TabRow<T extends string>({ tabs, active, onChange, className, compact = false }: TabRowProps<T>) {
  return (
    <div className={clsx("flex gap-2", className)}>
      {tabs.map(t => (
        <button
          key={t.key}
          className={clsx(
            "jt-btn-anim",
            T.btn(active === t.key ? "primary" : "ghost"),
            "flex-1 text-[13px]",
            compact ? "p-2" : "py-2.5 px-1",
          )}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
