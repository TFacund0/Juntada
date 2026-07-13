import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { GameCategory, GameDef } from "../games/gameTypes";
import { S } from "../theme/styles";
import { GameDetailDialog } from "./GameDetailDialog";

const CATEGORY_LABEL: Record<GameCategory, string> = {
  destacados: "Destacados",
  grupo: "Para competir",
  rapidos: "Juegos rápidos",
  equipos: "Por equipos",
  otros: "Más juegos",
};

// Fixed order for category sections when there's no active search.
const CATEGORY_ORDER: GameCategory[] = ["destacados", "grupo", "rapidos", "equipos", "otros"];

interface GamePickerProps {
  games: GameDef[];
  onPick: (id: string) => void;
}

// Search + category-grouped catalog grid for the "pick a game" screen.
// Replaces the old single-column list of full-width cards so the picker
// keeps scaling as more games get added — see games/gameTypes.ts for the
// `category` field each game opts into.
export function GamePicker({ games, onPick }: GamePickerProps) {
  const [query, setQuery] = useState("");
  // Every category starts expanded; collapsing one just hides its grid, it
  // never removes those games from a search match below.
  const [collapsed, setCollapsed] = useState<Set<GameCategory>>(() => new Set());
  // Tapping a card opens a preview instead of navigating straight into the
  // game — onPick(id) only fires once the player confirms from there.
  const [previewGame, setPreviewGame] = useState<GameDef | null>(null);

  const toggleCategory = (cat: GameCategory) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return games;
    return games.filter(g => g.label.toLowerCase().includes(q) || g.description.toLowerCase().includes(q));
  }, [games, query]);

  const grouped = useMemo(() => {
    if (query.trim()) return null; // searching: single "Resultados" grid instead
    const byCategory = new Map<GameCategory, GameDef[]>();
    for (const cat of CATEGORY_ORDER) byCategory.set(cat, []);
    for (const g of games) byCategory.get(g.category ?? "otros")!.push(g);
    return CATEGORY_ORDER.map(cat => ({ cat, items: byCategory.get(cat)! })).filter(section => section.items.length > 0);
  }, [games, query]);

  return (
    <div>
      <div style={S.searchBar}>
        <span style={{ opacity: 0.6 }}>🔍</span>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar juego..." style={S.searchInput} />
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

// Header-only toggle (no card wrapper) for a picker section — distinct from
// components/Collapsible.tsx, which boxes secondary info inside an S.card.
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
        <div key={g.id} style={{ ...S.catalogCard, opacity: g.comingSoon ? 0.55 : 1 }} onClick={() => onSelect(g)}>
          <div style={S.catalogThumb}>
            {g.icon}
            {g.comingSoon && <span style={S.soonBadge}>Próximamente</span>}
          </div>
          <div style={S.catalogName}>{g.label}</div>
        </div>
      ))}
    </div>
  );
}
