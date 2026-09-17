import clsx from "clsx";
import { T } from "../../../../theme/styles/classes";
import { CATEGORIES } from "@juntada/impostor-data";

interface CategoriesTabProps {
  enabledCategories: Record<string, boolean>;
  usedWords: Record<string, string[]>;
  onChange: (enabledCategories: Record<string, boolean>) => void;
}

// Idem para el patch que produce cada botón masivo — todas las categorías
// prendidas o todas apagadas, mismo shape, solo cambia el valor.
function allCategoriesSetTo(value: boolean): Record<string, boolean> {
  return Object.keys(CATEGORIES).reduce((acc, k) => ({ ...acc, [k]: value }), {} as Record<string, boolean>);
}

// "Seleccionar todas"/"Quitar todas" son el mismo botón con el estado
// invertido — antes cada uno repetía el mismo objeto de estilo entero
// cambiando solo qué condición mira, con el riesgo de que un ajuste futuro
// (color, padding) se aplicara a uno y no al otro por copy-paste.
function bulkBtnClass(active: boolean): string {
  return clsx(
    "flex-1 cursor-pointer rounded-lg px-3 py-2 font-[inherit] text-xs font-bold",
    active
      ? "border border-[rgba(224,32,43,0.4)] bg-[rgba(224,32,43,0.12)] text-[#FF6B6B]"
      : "border border-white/[0.14] bg-white/[0.04] text-[var(--jt-muted-text)]",
  );
}

// The "Categorías" config tab — identical between LocalGame and ConfigPanel
// (online), just wired to a different write path (local React state vs a
// patch sent to the server). Bulk-select buttons, one chip per category
// (toggle + remaining-words count), and a summary/exhausted warning below.
// Sin card propia: ConfigTabs (el único caller, ver ese componente) ya
// pone una sola card alrededor del switcher de tabs y el contenido de la
// tab activa — antes esto traía la suya y quedaban dos bloques separados
// para lo que es una sola sección.
export function CategoriesTab({ enabledCategories, usedWords, onChange }: CategoriesTabProps) {
  const activeKeys = Object.keys(enabledCategories || {}).filter(k => enabledCategories[k]);
  const wordsLeftIn = (catKey: string) => CATEGORIES[catKey].words.length - (usedWords[catKey] || []).length;
  const allCategoriesExhausted = activeKeys.length > 0 && activeKeys.every(k => wordsLeftIn(k) <= 0);

  const totalCategories = Object.keys(CATEGORIES).length;
  // Cada botón masivo solo se resalta de rojo cuando el estado actual
  // coincide exactamente con lo que ese botón produciría — si después se
  // prende/apaga una categoría suelta y ya no queda "todo prendido" ni "todo
  // apagado", ninguno de los dos queda marcado como si acabara de tocarse.
  const allSelected = activeKeys.length === totalCategories;
  const allDeselected = activeKeys.length === 0;

  return (
    <div>
      <p className={clsx(T.muted, "m-0 mb-3 leading-[1.4]")}>Elegí de qué van a ser las palabras. Tocá una categoría para activarla.</p>
      <style>{`
        .impostor-cats-bulk-btn {
          transition: transform 0.1s ease-out, filter 0.15s ease-out, box-shadow 0.15s ease-out, background 0.2s ease-out, border-color 0.2s ease-out, color 0.2s ease-out;
        }
        .impostor-cats-bulk-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.25);
        }
        .impostor-cats-bulk-btn:active {
          transform: scale(0.96);
        }
        .impostor-cats-bulk-btn-active {
          animation: impostor-cats-bulk-pop 0.3s ease-out;
        }
        @keyframes impostor-cats-bulk-pop {
          0% { transform: scale(0.94); }
          60% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .impostor-cats-chip {
          transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.15s ease-out, box-shadow 0.15s ease-out;
        }
        .impostor-cats-chip:hover {
          transform: translateY(-2px);
          filter: brightness(1.15);
        }
        .impostor-cats-chip:active {
          transform: translateY(0) scale(0.94);
        }
      `}</style>
      <div className="mb-3.5 flex gap-2">
        <button
          className={clsx("impostor-cats-bulk-btn", allSelected && "impostor-cats-bulk-btn-active", bulkBtnClass(allSelected))}
          onClick={() => onChange(allCategoriesSetTo(true))}
        >
          ✓ Seleccionar todas
        </button>
        <button
          className={clsx("impostor-cats-bulk-btn", allDeselected && "impostor-cats-bulk-btn-active", bulkBtnClass(allDeselected))}
          onClick={() => onChange(allCategoriesSetTo(false))}
        >
          ✕ Quitar todas
        </button>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {Object.entries(CATEGORIES).map(([k, cat]) => {
          const active = !!enabledCategories?.[k];
          const remaining = wordsLeftIn(k);
          const exhausted = remaining <= 0;
          return (
            <button
              key={k}
              className={clsx(
                "impostor-cats-chip flex cursor-pointer items-center gap-[7px] rounded-full px-4 py-2.5 font-[inherit] text-[13px] font-bold transition-all duration-150",
                active
                  ? "border border-[rgba(224,32,43,0.6)] bg-[linear-gradient(135deg,#E0202B,#7A1A20)] text-white shadow-[0_3px_14px_rgba(224,32,43,0.35)]"
                  : "border border-white/[0.12] bg-white/[0.04] text-[var(--jt-muted-text)] shadow-none",
                exhausted ? "opacity-55" : "opacity-100",
              )}
              onClick={() => onChange({ ...enabledCategories, [k]: !active })}
              title={exhausted ? "Ya se usaron todas las palabras de esta categoría en esta partida" : undefined}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span className="text-[11px] opacity-75">{exhausted ? "· sin palabras" : `· ${remaining}`}</span>
            </button>
          );
        })}
      </div>
      <p className={clsx(T.muted, "mt-3.5")}>
        {activeKeys.length === 0
          ? "No elegiste ninguna categoría todavía."
          : `${activeKeys.length} categoría${activeKeys.length === 1 ? "" : "s"} activa${activeKeys.length === 1 ? "" : "s"}.`}
      </p>
      {allCategoriesExhausted && (
        <p className="mt-1 text-xs text-[#F09595]">
          Ya se usaron todas las palabras de las categorías activas — activá otra para poder seguir jugando.
        </p>
      )}
    </div>
  );
}
