import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { CATEGORIES } from "@juntada/rayado-libre-data";

interface CategoryPickerProps {
  enabled: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  /** Texto opcional entre el encabezado y la grilla de chips (p. ej. la aclaración del lobby online). */
  description?: string;
}

const linkButtonClass = "bg-transparent border-none text-[#7F77DD] cursor-pointer text-xs font-bold font-[inherit]";

/**
 * Selector de categorías activas: encabezado con atajos "Todas"/"Ninguna" y
 * la grilla de chips, una por categoría.
 *
 * Compartido entre el modo local (`LocalGame`, pestaña de configuración) y
 * el modo online (`ConfigPanel`, lobby) — antes era el mismo bloque de JSX
 * duplicado en los dos archivos, solo cambiaba cómo se guardaba el cambio
 * (`setState` local vs `updateConfig` de la sala).
 *
 * @param enabled Mapa de categoría → si está activa.
 * @param onChange Reemplazo completo del mapa de categorías activas.
 */
export function CategoryPicker({ enabled, onChange, description }: CategoryPickerProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <span className={T.label}>Categorías</span>
        <div className="flex gap-2.5">
          <button onClick={() => onChange(Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: true }), {}))} className={linkButtonClass}>
            Todas
          </button>
          <button
            onClick={() => onChange(Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: false }), {}))}
            className={linkButtonClass}
          >
            Ninguna
          </button>
        </div>
      </div>
      {description && <p className={clsx(T.muted, "mt-1 mb-3.5 leading-[1.4]")}>{description}</p>}
      <div className="flex flex-wrap gap-2.5 mt-2.5">
        {Object.entries(CATEGORIES).map(([k, cat]) => {
          const active = !!enabled[k];
          return (
            <button
              key={k}
              onClick={() => onChange({ ...enabled, [k]: !active })}
              className={clsx(
                "flex items-center gap-[7px] rounded-full px-4 py-2.5 text-[13px] font-bold font-[inherit] cursor-pointer",
                active
                  ? "border border-[rgba(127,119,221,0.6)] bg-[linear-gradient(135deg,#7F77DD,#534AB7)] text-white"
                  : "border border-white/[0.12] bg-white/[0.04] text-[#9089c0]",
              )}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
