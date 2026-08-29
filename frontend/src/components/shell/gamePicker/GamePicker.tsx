import { useState } from "react";
import type { CSSProperties } from "react";
import type { GameCategory, GameDef } from "../../../games/gameTypes";
import { S } from "../../../theme/styles";
import { DEFAULT_COLORS } from "../../../theme/styles/colors";
import { GameDetailDialog } from "../GameDetailDialog";
import { SearchIcon } from "../../ui/icons";
import { CategorySection } from "./CategorySection";
import { GameGrid } from "./GameGrid";
import { useGamePickerFilters } from "./useGamePickerFilters";
import { CATEGORY_LABEL, CATEGORY_ORDER, AVAILABILITY_LABEL } from "./gamePickerMeta";
import type { AvailabilityFilter, CategoryFilter } from "./gamePickerMeta";
import "./GamePicker.css";

interface GamePickerProps {
  games: GameDef[];
  onPick: (id: string) => void;
  /**
   * `false` oculta los tabs "Disponibles/Próximamente" y muestra siempre
   * solo los disponibles — usado por NewGameDialog, donde no tiene sentido
   * ofrecer "Próximamente" dentro de un grupo ya armado. Default `true`
   * (comportamiento del catálogo del menú principal, sin tocar).
   */
  showAvailabilityFilter?: boolean;
  /**
   * `false` hace que "Destacados" use el mismo tamaño de card que el resto
   * de las categorías en vez de la grilla grande — usado por NewGameDialog.
   * Default `true` (comportamiento del menú principal, sin tocar).
   */
  featuredLayout?: boolean;
}

/**
 * Grilla de catálogo con búsqueda + agrupado por categoría para la pantalla
 * de "elegir un juego". Reemplaza a la vieja lista de una sola columna de
 * cards de ancho completo, para que el picker siga escalando a medida que
 * se agregan más juegos — ver el campo `category` en `games/gameTypes.ts`
 * que cada juego adopta.
 */
export function GamePicker({ games, onPick, showAvailabilityFilter = true, featuredLayout = true }: GamePickerProps) {
  const [query, setQuery] = useState("");
  // Toda categoría arranca expandida; colapsar una solo oculta su grilla,
  // nunca saca esos juegos de un match de búsqueda más abajo.
  const [collapsed, setCollapsed] = useState<Set<GameCategory>>(() => new Set());
  // Tocar una card abre una vista previa en vez de navegar directo al
  // juego — onPick(id) solo se dispara una vez que el jugador confirma
  // desde ahí.
  const [previewGame, setPreviewGame] = useState<GameDef | null>(null);
  // Por defecto oculta los juegos comingSoon para que el catálogo solo
  // muestre lo que realmente se puede jugar; los chips dejan a los
  // jugadores asomarse a lo que viene.
  const [availFilter, setAvailFilter] = useState<AvailabilityFilter>("available");
  const [activeCat, setActiveCat] = useState<CategoryFilter>("todos");

  const toggleCategory = (cat: GameCategory) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const { filtered, grouped } = useGamePickerFilters({ games, query, availFilter, activeCat, showAvailabilityFilter });

  return (
    <div>
      {/* Sticky justo debajo del navbar (mismo criterio que el diseño de
          referencia: la barra de búsqueda + disponibilidad queda fija al
          scrollear, los chips de categoría no). */}
      <div className="jt-sticky-controls">
        <label className="jt-search-field">
          <span className="sr-only">Buscar juego</span>
          <span className="jt-search-field-icon" aria-hidden>
            <SearchIcon />
          </span>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar juego…" className="jt-search-field-input" />
        </label>

        {showAvailabilityFilter && (
          <div className="jt-avail-tabs" role="tablist" aria-label="Estado de los juegos">
            {(Object.keys(AVAILABILITY_LABEL) as AvailabilityFilter[]).map(key => (
              <button
                key={key}
                role="tab"
                aria-selected={availFilter === key}
                className="jt-avail-chip"
                onClick={() => setAvailFilter(key)}
                style={availChipStyle(availFilter === key)}
              >
                {AVAILABILITY_LABEL[key]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="jt-cat-chip-row">
        {(["todos", ...CATEGORY_ORDER] as CategoryFilter[]).map(cat => (
          <button
            key={cat}
            className={activeCat === cat ? "jt-cat-chip jt-cat-chip--active" : "jt-cat-chip"}
            onClick={() => setActiveCat(cat)}
            aria-pressed={activeCat === cat}
          >
            {cat === "todos" ? "Todos" : CATEGORY_LABEL[cat]}
          </button>
        ))}
      </div>

      {grouped ? (
        grouped.map(section => (
          <CategorySection
            key={section.cat}
            title={CATEGORY_LABEL[section.cat]}
            count={section.items.length}
            open={!collapsed.has(section.cat)}
            onToggle={() => toggleCategory(section.cat)}
          >
            <GameGrid games={section.items} onSelect={setPreviewGame} featured={featuredLayout && section.cat === "destacados"} />
          </CategorySection>
        ))
      ) : filtered.length > 0 ? (
        <div>
          <div style={S.sectionLabel}>Resultados</div>
          <GameGrid games={filtered} onSelect={setPreviewGame} />
        </div>
      ) : (
        <p style={{ ...S.muted, textAlign: "center", marginTop: 24 }}>No encontramos juegos que coincidan con "{query}".</p>
      )}

      {previewGame && (
        <GameDetailDialog
          game={previewGame}
          onClose={() => setPreviewGame(null)}
          onStart={() => {
            onPick(previewGame.id);
            setPreviewGame(null);
          }}
        />
      )}
    </div>
  );
}

function availChipStyle(active: boolean): CSSProperties {
  return {
    flex: 1,
    padding: "8px 16px",
    borderRadius: 12,
    border: "none",
    background: active ? `color-mix(in srgb, var(--jt-accent, ${DEFAULT_COLORS.accent}) 25%, transparent)` : "transparent",
    boxShadow: active
      ? `0 0 0 1px color-mix(in srgb, var(--jt-accent, ${DEFAULT_COLORS.accent}) 35%, transparent), 0 0 40px -10px color-mix(in srgb, var(--jt-accent, ${DEFAULT_COLORS.accent}) 60%, transparent)`
      : "none",
    color: active ? "#e8e4f0" : "var(--jt-muted-text, #a49dc9)",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.3s ease",
  };
}
