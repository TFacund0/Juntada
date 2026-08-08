import type { GameCategory } from "../../../games/gameTypes";

export const CATEGORY_LABEL: Record<GameCategory, string> = {
  destacados: "Destacados",
  rapidos: "Juegos rápidos",
  palabras: "Palabras e ingenio",
  fiesta: "Para la previa",
  equipos: "Por equipos",
  tematicos: "Con su propia temática",
  otros: "Más juegos",
};

// Orden fijo de las secciones de categoría cuando no hay una búsqueda activa.
export const CATEGORY_ORDER: GameCategory[] = ["destacados", "rapidos", "palabras", "fiesta", "equipos", "tematicos", "otros"];

export type AvailabilityFilter = "available" | "soon";

export const AVAILABILITY_LABEL: Record<AvailabilityFilter, string> = {
  available: "Disponibles",
  soon: "Próximamente",
};

// "Todos" + una entrada por categoría — fila de chips de scroll horizontal
// que angosta el catálogo a una sola categoría, además de (no en vez de) el
// agrupado por secciones de abajo.
export type CategoryFilter = "todos" | GameCategory;
