import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { CATEGORIES } from "@juntada/quien-soy-data";

const linkButtonClass = "bg-transparent border-none text-[#7F77DD] cursor-pointer text-xs font-bold font-[inherit]";

// "¿De dónde salen las palabras?" editor — shared by local mode's own setup
// screen and the online lobby's ConfigPanel, so both read identically.
// "categories": deal a word straight from the host's active category pool.
// "suggested": everyone writes a word for a random target and the group
// votes on it (see engine.ts's suggest/vote phases) — no category toggles
// needed in that mode.
export function WordSourceConfig({
  wordSource,
  activeCategories,
  onChange,
}: {
  wordSource: "categories" | "suggested";
  activeCategories: Record<string, boolean>;
  onChange: (patch: { wordSource?: "categories" | "suggested"; activeCategories?: Record<string, boolean> }) => void;
}) {
  return (
    <div>
      <div className={T.card}>
        <span className={T.label}>¿De dónde salen las palabras?</span>
        <p className={clsx(T.muted, "mb-2.5 leading-[1.4]")}>
          De categorías predefinidas, o que cada uno le escriba una palabra a otro jugador (al azar) y el grupo vote cuál usar.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => onChange({ wordSource: "categories" })}
            className={clsx(T.btn(wordSource === "categories" ? "primary" : "ghost"), "flex-1 p-2 text-[13px]")}
          >
            Categorías
          </button>
          <button
            onClick={() => onChange({ wordSource: "suggested" })}
            className={clsx(T.btn(wordSource === "suggested" ? "primary" : "ghost"), "flex-1 p-2 text-[13px]")}
          >
            Sugeridas y votadas
          </button>
        </div>
      </div>

      {wordSource === "categories" && (
        <div className={T.card}>
          <div className="flex items-center justify-between">
            <span className={T.label}>Categorías</span>
            <div className="flex gap-2.5">
              <button
                onClick={() => onChange({ activeCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: true }), {}) })}
                className={linkButtonClass}
              >
                Todas
              </button>
              <button
                onClick={() => onChange({ activeCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: false }), {}) })}
                className={linkButtonClass}
              >
                Ninguna
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5 mt-2.5">
            {Object.entries(CATEGORIES).map(([k, cat]) => {
              const active = !!activeCategories[k];
              return (
                <button
                  key={k}
                  onClick={() => onChange({ activeCategories: { ...activeCategories, [k]: !active } })}
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
        </div>
      )}
    </div>
  );
}
