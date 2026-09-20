import { useMemo } from "react";
import type { GameCategory, GameDef } from "../../../games/gameTypes";
import { isUnderMaintenance } from "../../../games/maintenance";
import { CATEGORY_ORDER } from "./gamePickerMeta";
import type { AvailabilityFilter, CategoryFilter } from "./gamePickerMeta";

interface UseGamePickerFiltersArgs {
  games: GameDef[];
  query: string;
  availFilter: AvailabilityFilter;
  activeCat: CategoryFilter;
  showAvailabilityFilter: boolean;
}

interface UseGamePickerFiltersResult {
  availableGames: GameDef[];
  filtered: GameDef[];
  grouped: { cat: GameCategory; items: GameDef[] }[] | null;
}

// Lógica pura de filtrado/agrupado del picker — extraída verbatim de
// GamePicker.tsx para poder testearla con fixtures sin montar el componente.
export function useGamePickerFilters({
  games,
  query,
  availFilter,
  activeCat,
  showAvailabilityFilter,
}: UseGamePickerFiltersArgs): UseGamePickerFiltersResult {
  const availableGames = useMemo(() => {
    if (showAvailabilityFilter && availFilter === "soon") return games.filter(g => g.comingSoon || isUnderMaintenance(g));
    return games.filter(g => !g.comingSoon && !isUnderMaintenance(g));
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

  return { availableGames, filtered, grouped };
}
