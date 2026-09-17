import { useState } from "react";
import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { DEFAULT_CATEGORIES, LETTERS } from "@juntada/tutifruti-data";
import { Btn } from "../../../components/ui/Btn";
import type { ConfigPanelProps } from "../../gameTypes";
import { PageNumbers } from "./PageNumbers";
import { CategoryChip } from "./CategoryChip";

interface Category {
  id: string;
  label: string;
  icon?: string;
}

// DEFAULT_CATEGORIES alone is well over 100 entries — showing them all in one
// long wrapping list meant scrolling a long way down just to find one to
// toggle. Paged instead, same idea as a search results list.
const CATEGORIES_PER_PAGE = 20;

// Host-only rules editor shown in the multiplayer lobby. One card per tab
// (not one card per question) so the panel reads as a single flowing area
// instead of a stack of disconnected boxes — sections inside are split with
// thin dividers rather than separate cards.
export function ConfigPanel({ room, updateConfig }: ConfigPanelProps) {
  const [tab, setTab] = useState<"cats" | "rules" | "letters">("rules");
  const [newCat, setNewCat] = useState("");
  const [showActive, setShowActive] = useState(false);
  const [page, setPage] = useState(0);
  const config = room.config as {
    customCategories?: Category[];
    activeCategories?: Record<string, boolean>;
    enabledLetters?: Record<string, boolean>;
    randomCategoryMode?: boolean;
    randomCategoryCount?: number;
    rounds: number;
    endMode: "timer" | "basta";
    roundTime: number;
  };
  const customCategories: Category[] = config.customCategories || [];
  const customIds = new Set(customCategories.map(c => c.id));
  const allCategories: Category[] = [...DEFAULT_CATEGORIES, ...customCategories];
  const activeList = allCategories.filter(c => !!config.activeCategories?.[c.id]);
  const activeCount = activeList.length;
  const activeLetterCount = (LETTERS as string[]).filter(l => !!config.enabledLetters?.[l]).length;
  const randomMode = !!config.randomCategoryMode;
  const randomPoolSize = allCategories.length;
  const randomMax = Math.max(1, Math.min(20, randomPoolSize));
  const randomCount = Math.max(1, Math.min(config.randomCategoryCount || 6, randomMax));

  const toggleLetter = (l: string) => {
    updateConfig({ enabledLetters: { ...config.enabledLetters, [l]: !config.enabledLetters?.[l] } });
  };

  const pageCount = Math.ceil(DEFAULT_CATEGORIES.length / CATEGORIES_PER_PAGE);
  const currentPage = Math.min(page, pageCount - 1);
  const pagedCategories = DEFAULT_CATEGORIES.slice(currentPage * CATEGORIES_PER_PAGE, (currentPage + 1) * CATEGORIES_PER_PAGE);

  const addCustomCategory = () => {
    const label = newCat.trim();
    if (!label) return;
    const id = `custom_${Date.now()}`;
    updateConfig({
      customCategories: [...customCategories, { id, label }],
      activeCategories: { ...config.activeCategories, [id]: true },
    });
    setNewCat("");
  };

  const removeCustomCategory = (id: string) => {
    updateConfig({ customCategories: customCategories.filter(c => c.id !== id) });
  };

  const toggleCategory = (id: string) => {
    updateConfig({ activeCategories: { ...config.activeCategories, [id]: !config.activeCategories?.[id] } });
  };

  return (
    <div className={T.card}>
      <span className={T.label}>Configuración</span>
      <div className="flex gap-2">
        {(["cats", "letters", "rules"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={clsx(T.btn(tab === t ? "primary" : "ghost"), T.tabBtnOverride)}>
            {t === "cats" ? "Categorías" : t === "letters" ? "Letras" : "Reglas"}
          </button>
        ))}
      </div>

      <div className={T.divider} />

      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-[#e8e4f0]">
          {randomMode
            ? `${randomCount} categoría${randomCount === 1 ? "" : "s"} por ronda (aleatorias)`
            : activeCount === 0
              ? "Ninguna categoría activa"
              : `${activeCount} categoría${activeCount === 1 ? "" : "s"} activa${activeCount === 1 ? "" : "s"}`}
        </span>
        {!randomMode && activeCount > 0 && (
          <button
            onClick={() => setShowActive(v => !v)}
            className="cursor-pointer border-none bg-transparent font-[inherit] text-[13px] font-bold text-[#7F77DD]"
          >
            {showActive ? "Ocultar" : "Ver cuáles"}
          </button>
        )}
      </div>
      {!randomMode && showActive && activeCount > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {activeList.map(c => (
            <span key={c.id} className={T.pill(true)}>
              {c.icon} {c.label}
            </span>
          ))}
        </div>
      )}

      {tab === "rules" && (
        <>
          <div className={T.divider} />

          <span className={T.label}>Rondas: {config.rounds}</span>
          <p className={clsx(T.muted, "mt-1 mb-2 leading-[1.4]")}>Cuántas rondas se juegan en total.</p>
          <input
            type="range"
            min="1"
            max="15"
            step="1"
            value={config.rounds}
            onChange={e => updateConfig({ rounds: +e.target.value })}
            className="w-full"
          />

          <div className={T.divider} />

          <span className={T.label}>¿Cómo termina la ronda?</span>
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => updateConfig({ endMode: "timer" })}
              className={clsx(T.btn(config.endMode === "timer" ? "primary" : "ghost"), T.segmentedBtnOverride)}
            >
              Por tiempo
            </button>
            <button
              onClick={() => updateConfig({ endMode: "basta" })}
              className={clsx(T.btn(config.endMode === "basta" ? "primary" : "ghost"), T.segmentedBtnOverride)}
            >
              Por "¡Basta!"
            </button>
          </div>
          <p className={clsx(T.muted, "mt-2.5 leading-[1.4]")}>
            {config.endMode === "basta"
              ? "La ronda termina apenas alguien complete todas las categorías y grite '¡Basta!'."
              : "La ronda termina cuando se acaba el tiempo, sin importar quién haya terminado."}
          </p>

          <div className={T.divider} />

          <span className={T.label}>Tiempo por ronda: {config.endMode === "basta" ? "No aplica" : `${config.roundTime}s`}</span>
          <p className={clsx(T.muted, "mt-1 mb-2 leading-[1.4]")}>Cuánto dura cada ronda antes de cortar.</p>
          <input
            type="range"
            min="30"
            max="240"
            step="15"
            value={config.roundTime}
            disabled={config.endMode === "basta"}
            onChange={e => updateConfig({ roundTime: +e.target.value })}
            className={T.rangeInput(config.endMode === "basta")}
          />
        </>
      )}

      {tab === "cats" && (
        <>
          <div className={T.divider} />

          <span className={T.label}>¿Cómo se eligen las categorías?</span>
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => updateConfig({ randomCategoryMode: false })}
              className={clsx(T.btn(!randomMode ? "primary" : "ghost"), T.segmentedBtnOverride)}
            >
              Elegir a mano
            </button>
            <button
              onClick={() => updateConfig({ randomCategoryMode: true })}
              className={clsx(T.btn(randomMode ? "primary" : "ghost"), T.segmentedBtnOverride)}
            >
              Aleatorias
            </button>
          </div>
          <p className={clsx(T.muted, "mt-2.5 leading-[1.4]")}>
            {randomMode
              ? "Cada ronda sortea sola una cantidad fija de categorías de entre todas las disponibles (más las que agregues abajo) — una forma más rápida de armar la partida."
              : "Elegís vos qué categorías entran, tildándolas una por una más abajo."}
          </p>

          {randomMode && (
            <>
              <div className={T.divider} />
              <span className={T.label}>Cantidad de categorías por ronda: {randomCount}</span>
              <p className={clsx(T.muted, "mt-1 mb-2 leading-[1.4]")}>
                Cuántas categorías salen sorteadas en cada ronda (de un total de {randomPoolSize} disponibles).
              </p>
              <input
                type="range"
                min="1"
                max={randomMax}
                step="1"
                value={randomCount}
                onChange={e => updateConfig({ randomCategoryCount: +e.target.value })}
                className="w-full"
              />
            </>
          )}

          <div className={T.divider} />

          <span className={T.label}>Agregar categoría</span>
          <p className={clsx(T.muted, "mt-1 mb-3 leading-[1.4]")}>
            {randomMode
              ? "Sumá una categoría propia — entra al pool del que se sortea cada ronda, junto con todas las de por defecto."
              : "Sumá una categoría propia, además de las de abajo."}
          </p>
          <div className="flex gap-2">
            <input
              className={clsx(T.input, "flex-1")}
              placeholder="Nueva categoría..."
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") addCustomCategory();
              }}
            />
            <Btn variant="ghost" onClick={addCustomCategory} className="w-auto px-[18px] py-[11px]">
              Agregar
            </Btn>
          </div>

          {customCategories.length > 0 && (
            <>
              <div className={T.divider} />
              <span className={T.label}>Tus categorías</span>
              <p className={clsx(T.muted, "mb-3.5 leading-[1.4]")}>
                {randomMode
                  ? "Ya entran todas al sorteo — tocá la × para sacar alguna."
                  : "Las que agregaste vos, siempre a mano sin importar la página."}
              </p>
              <div className="flex flex-wrap gap-2.5">
                {customCategories.map(cat => (
                  <CategoryChip
                    key={cat.id}
                    cat={cat}
                    active={randomMode ? true : !!config.activeCategories?.[cat.id]}
                    onToggle={randomMode ? () => {} : () => toggleCategory(cat.id)}
                    onRemove={() => removeCustomCategory(cat.id)}
                  />
                ))}
              </div>
            </>
          )}

          {!randomMode && (
            <>
              <div className={T.divider} />

              <span className={T.label}>Categorías</span>
              <p className={clsx(T.muted, "mt-1 mb-3.5 leading-[1.4]")}>Tocá una categoría para activarla o desactivarla en la partida.</p>
              {pageCount > 1 && <PageNumbers pageCount={pageCount} currentPage={currentPage} onChange={setPage} />}
              <div className="flex flex-wrap gap-2.5">
                {pagedCategories.map(cat => (
                  <CategoryChip
                    key={cat.id}
                    cat={cat}
                    active={!!config.activeCategories?.[cat.id]}
                    onToggle={() => toggleCategory(cat.id)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === "letters" && (
        <>
          <div className={T.divider} />

          <div className="flex items-center justify-between">
            <span className={T.label}>Letras</span>
            <span className="text-xs font-bold text-[#9089c0]">
              {activeLetterCount} activa{activeLetterCount === 1 ? "" : "s"}
            </span>
          </div>
          <p className={clsx(T.muted, "mt-1 mb-3.5 leading-[1.4]")}>
            Tocá una letra para activarla o desactivarla — ya vienen preseleccionadas las más comunes.
          </p>
          {activeLetterCount === 0 && (
            <p className="mb-3.5 text-xs text-[#E2C44A]">Activá al menos una letra para poder empezar una ronda.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {(LETTERS as string[]).map(l => {
              const active = !!config.enabledLetters?.[l];
              return (
                <button key={l} onClick={() => toggleLetter(l)} className={T.letterTile(active)}>
                  {l}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
