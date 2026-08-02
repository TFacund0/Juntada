import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { GameCategory, GameDef } from "../../games/gameTypes";
import { isUnderMaintenance, isGameAvailable } from "../../games/maintenance";
import { PICKER_META } from "../../games/pickerMeta";
import { S } from "../../theme/styles";
import { GameDetailDialog } from "./GameDetailDialog";
import "./GamePicker.css";

// SVGs en línea (Feather-style, trazo) en vez de emoji/glifos de texto —
// mismo criterio que AppHeader/ModePicker/MenuScreen.
function SearchIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, transition: "transform 0.15s ease", transform: open ? "rotate(180deg)" : "none" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

const CATEGORY_LABEL: Record<GameCategory, string> = {
  destacados: "Destacados",
  rapidos: "Juegos rápidos",
  palabras: "Palabras e ingenio",
  fiesta: "Para la previa",
  equipos: "Por equipos",
  tematicos: "Con su propia temática",
  otros: "Más juegos",
};

// Orden fijo de las secciones de categoría cuando no hay una búsqueda activa.
const CATEGORY_ORDER: GameCategory[] = ["destacados", "rapidos", "palabras", "fiesta", "equipos", "tematicos", "otros"];

type AvailabilityFilter = "available" | "soon";

const AVAILABILITY_LABEL: Record<AvailabilityFilter, string> = {
  available: "Disponibles",
  soon: "Próximamente",
};

// "Todos" + una entrada por categoría — fila de chips de scroll horizontal
// que angosta el catálogo a una sola categoría, además de (no en vez de) el
// agrupado por secciones de abajo.
type CategoryFilter = "todos" | GameCategory;

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

  const availableGames = useMemo(() => {
    if (showAvailabilityFilter && availFilter === "soon") return games.filter(g => g.comingSoon && !isUnderMaintenance(g));
    return games.filter(g => !g.comingSoon || isUnderMaintenance(g));
  }, [games, availFilter, showAvailabilityFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availableGames;
    return availableGames.filter(g => g.label.toLowerCase().includes(q) || g.description.toLowerCase().includes(q));
  }, [availableGames, query]);

  const grouped = useMemo(() => {
    if (query.trim()) return null; // buscando: en vez de esto, una sola grilla de "Resultados"
    const cats = activeCat === "todos" ? CATEGORY_ORDER : [activeCat];
    const byCategory = new Map<GameCategory, GameDef[]>();
    for (const cat of cats) byCategory.set(cat, []);
    for (const g of availableGames) {
      const cat = g.category ?? "otros";
      if (byCategory.has(cat)) byCategory.get(cat)!.push(g);
    }
    return cats.map(cat => ({ cat, items: byCategory.get(cat)! })).filter(section => section.items.length > 0);
  }, [availableGames, query, activeCat]);

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

interface CategorySectionProps {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

// Toggle de solo encabezado (sin envoltorio de card) para una sección del
// picker — distinto de components/Collapsible.tsx, que encierra información
// secundaria dentro de una S.card.
function CategorySection({ title, count, open, onToggle, children }: CategorySectionProps) {
  return (
    <div style={{ marginBottom: 24 }}>
      <button onClick={onToggle} style={categoryHeaderStyle}>
        <span className="jt-cat-title">{title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--jt-accent-strong, #afa9ec)",
            }}
          >
            {count} {count === 1 ? "juego" : "juegos"}
          </span>
          <span style={{ color: "var(--jt-label, #7F77DD)", display: "flex" }}>
            <ChevronDownIcon open={open} />
          </span>
        </span>
      </button>
      {open && children}
    </div>
  );
}

function availChipStyle(active: boolean): CSSProperties {
  return {
    flex: 1,
    padding: "8px 16px",
    borderRadius: 12,
    border: "none",
    background: active ? "color-mix(in srgb, var(--jt-accent, #7F77DD) 25%, transparent)" : "transparent",
    boxShadow: active
      ? "0 0 0 1px color-mix(in srgb, var(--jt-accent, #7F77DD) 35%, transparent), 0 0 40px -10px color-mix(in srgb, var(--jt-accent, #7F77DD) 60%, transparent)"
      : "none",
    color: active ? "#e8e4f0" : "var(--jt-muted-text, #a49dc9)",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.3s ease",
  };
}

const categoryHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 12,
  width: "100%",
  background: "none",
  border: "none",
  padding: 0,
  marginBottom: 8,
  cursor: "pointer",
  fontFamily: "inherit",
};

function GameGrid({ games, onSelect, featured = false }: { games: GameDef[]; onSelect: (game: GameDef) => void; featured?: boolean }) {
  return (
    <div className={featured ? "jt-game-grid jt-game-grid--featured" : "jt-game-grid"}>
      {games.map((g, i) => {
        const meta = PICKER_META[g.id];
        const dimmed = !isGameAvailable(g);
        return (
          <div
            key={g.id}
            // jt-animate-rise termina en opacity:1 (ver jt-rise en
            // homeDesign.css) — pisaría el opacity:0.55 de "dimmed" una vez
            // terminada la animación, así que esas cards quedan sin la
            // entrada animada.
            className={dimmed ? "jt-game-card" : "jt-game-card jt-animate-rise"}
            style={{
              ...S.catalogCard,
              opacity: dimmed ? 0.55 : 1,
              animationDelay: dimmed ? undefined : `${Math.min(i, 10) * 55}ms`,
            }}
            onClick={() => onSelect(g)}
          >
            <span className="jt-shine" aria-hidden />
            <div
              className={featured ? "jt-game-thumb jt-game-thumb--featured" : "jt-game-thumb"}
              style={{ ...S.catalogThumb, aspectRatio: featured ? "16 / 10" : "4 / 3", fontSize: featured ? 46 : 32, overflow: "hidden" }}
            >
              {g.logo ? (
                <img
                  src={g.logo}
                  alt={g.label}
                  className="jt-card-thumb-img"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                g.icon
              )}
              {meta && !g.comingSoon && <span className="jt-card-time-badge">{meta.minutes}</span>}
              {isUnderMaintenance(g) ? (
                <span style={{ ...S.soonBadge, color: "#EF9F27" }}>En mantenimiento</span>
              ) : (
                g.comingSoon && <span style={S.soonBadge}>Próximamente</span>
              )}
            </div>
            <div
              className={featured ? "jt-game-body jt-game-body--featured" : "jt-game-body"}
              style={{
                padding: featured ? "12px 14px 14px" : "10px 12px 12px",
                borderTop: "1px solid var(--jt-row-border, rgba(127,119,221,0.08))",
              }}
            >
              <div
                className={featured ? "jt-game-title jt-game-title--featured" : "jt-game-title"}
                style={{
                  fontWeight: 700,
                  fontSize: featured ? 16 : 14,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {g.label}
              </div>
              <p
                className={featured ? "jt-game-tagline jt-game-tagline--featured" : "jt-game-tagline"}
                style={{
                  margin: "3px 0 0",
                  fontSize: featured ? 12.5 : 11.5,
                  color: "var(--jt-muted-text, #a49dc9)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {meta?.tagline ?? g.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
