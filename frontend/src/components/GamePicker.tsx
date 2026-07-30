import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { GameCategory, GameDef } from "../games/gameTypes";
import { isUnderMaintenance } from "../games/maintenance";
import { S } from "../theme/styles";
import { GameDetailDialog } from "./GameDetailDialog";

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

interface GamePickerProps {
  games: GameDef[];
  onPick: (id: string) => void;
}

/**
 * Grilla de catálogo con búsqueda + agrupado por categoría para la pantalla
 * de "elegir un juego". Reemplaza a la vieja lista de una sola columna de
 * cards de ancho completo, para que el picker siga escalando a medida que
 * se agregan más juegos — ver el campo `category` en `games/gameTypes.ts`
 * que cada juego adopta.
 */
export function GamePicker({ games, onPick }: GamePickerProps) {
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

  const toggleCategory = (cat: GameCategory) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const availableGames = useMemo(() => {
    if (availFilter === "soon") return games.filter(g => g.comingSoon && !isUnderMaintenance(g));
    return games.filter(g => !g.comingSoon || isUnderMaintenance(g));
  }, [games, availFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availableGames;
    return availableGames.filter(g => g.label.toLowerCase().includes(q) || g.description.toLowerCase().includes(q));
  }, [availableGames, query]);

  const grouped = useMemo(() => {
    if (query.trim()) return null; // buscando: en vez de esto, una sola grilla de "Resultados"
    const byCategory = new Map<GameCategory, GameDef[]>();
    for (const cat of CATEGORY_ORDER) byCategory.set(cat, []);
    for (const g of availableGames) byCategory.get(g.category ?? "otros")!.push(g);
    return CATEGORY_ORDER.map(cat => ({ cat, items: byCategory.get(cat)! })).filter(section => section.items.length > 0);
  }, [availableGames, query]);

  return (
    <div>
      <div style={S.searchBar}>
        <span style={{ opacity: 0.6 }}>🔍</span>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar juego..." style={S.searchInput} />
      </div>

      <div style={{ display: "flex", gap: 8, margin: "10px 0 16px" }}>
        {(Object.keys(AVAILABILITY_LABEL) as AvailabilityFilter[]).map(key => (
          <button key={key} onClick={() => setAvailFilter(key)} style={availChipStyle(availFilter === key)}>
            {AVAILABILITY_LABEL[key]}
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
            <GameGrid games={section.items} onSelect={setPreviewGame} />
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
    <div style={{ marginBottom: 22 }}>
      <button onClick={onToggle} style={categoryHeaderStyle}>
        <span style={S.sectionLabel}>
          {title} <span style={{ opacity: 0.6 }}>· {count}</span>
        </span>
        <span style={{ color: "#7F77DD", fontSize: 12, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          ▼
        </span>
      </button>
      {open && children}
    </div>
  );
}

function availChipStyle(active: boolean): CSSProperties {
  return {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 10,
    border: active ? "1px solid #7F77DD" : "1px solid rgba(127,119,221,0.25)",
    background: active ? "rgba(127,119,221,0.2)" : "transparent",
    color: active ? "#e8e4f0" : "#a49dc9",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

const categoryHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  background: "none",
  border: "none",
  padding: 0,
  marginBottom: 8,
  cursor: "pointer",
  fontFamily: "inherit",
};

function GameGrid({ games, onSelect }: { games: GameDef[]; onSelect: (game: GameDef) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {games.map(g => (
        <div key={g.id} style={{ ...S.catalogCard, opacity: g.comingSoon || isUnderMaintenance(g) ? 0.55 : 1 }} onClick={() => onSelect(g)}>
          <div style={{ ...S.catalogThumb, overflow: "hidden" }}>
            {g.logo ? <img src={g.logo} alt={g.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : g.icon}
            {isUnderMaintenance(g) ? (
              <span style={{ ...S.soonBadge, color: "#EF9F27" }}>En mantenimiento</span>
            ) : (
              g.comingSoon && <span style={S.soonBadge}>Próximamente</span>
            )}
          </div>
          <div style={S.catalogName}>{g.label}</div>
        </div>
      ))}
    </div>
  );
}
