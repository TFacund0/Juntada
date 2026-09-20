import { useState } from "react";
import type { ReactNode } from "react";
import clsx from "clsx";
import { T } from "../../theme/styles/classes";

interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Una `T.card` que arranca colapsada mostrando solo su título — usada para
 * información secundaria (puntos de la ronda, tablas de posiciones) que de
 * otro modo saturaría la pantalla una vez que hay varios jugadores.
 */
export function Collapsible({ title, defaultOpen = false, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={T.card}>
      <button
        onClick={() => setOpen(v => !v)}
        className={clsx(
          "flex items-center justify-between w-full bg-transparent border-none p-0 cursor-pointer font-[inherit]",
          open ? "mb-2.5" : "mb-0",
        )}
      >
        <span className={clsx(T.label, "mb-0!")}>{title}</span>
        <span className={clsx("text-[var(--jt-accent)] text-xs transition-transform duration-150", open ? "rotate-180" : "")}>▼</span>
      </button>
      {open && children}
    </div>
  );
}
