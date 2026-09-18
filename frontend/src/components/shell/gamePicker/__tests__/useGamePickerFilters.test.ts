import { describe, test, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useGamePickerFilters } from "../useGamePickerFilters";
import type { GameDef } from "../../../../games/gameTypes";

// Fixtures deliberately minimal — only the fields the hook actually reads
// (label/description/comingSoon/maintenance/category), decoupled from the
// real game registry.
const destacado = { id: "a", label: "Impostor", description: "Encontrá al impostor", category: "destacados" } as unknown as GameDef;
const rapido = { id: "b", label: "Ruleta", description: "Girá la ruleta", category: "rapidos" } as unknown as GameDef;
const sinCategoria = { id: "c", label: "Sin Categoria", description: "no tiene categoria propia" } as unknown as GameDef;
const comingSoon = { id: "d", label: "Futuro", description: "todavia no", category: "otros", comingSoon: true } as unknown as GameDef;
const enMantenimiento = {
  id: "e",
  label: "Mantenimiento",
  description: "bloqueado temporalmente",
  category: "otros",
  comingSoon: true,
  maintenance: true,
} as unknown as GameDef;

const allGames = [destacado, rapido, sinCategoria, comingSoon, enMantenimiento];

function run(overrides: Partial<Parameters<typeof useGamePickerFilters>[0]> = {}) {
  const { result } = renderHook(() =>
    useGamePickerFilters({
      games: allGames,
      query: "",
      availFilter: "available",
      activeCat: "todos",
      showAvailabilityFilter: true,
      ...overrides,
    }),
  );
  return result.current;
}

describe("useGamePickerFilters", () => {
  test("availFilter 'available' excludes comingSoon games unless under maintenance", () => {
    const { availableGames } = run();
    const ids = availableGames.map(g => g.id);
    expect(ids).toContain(enMantenimiento.id); // maintenance games stay visible even while comingSoon
    expect(ids).not.toContain(comingSoon.id);
    expect(ids).toEqual(expect.arrayContaining([destacado.id, rapido.id, sinCategoria.id]));
  });

  test("availFilter 'soon' shows only comingSoon games, excluding maintenance ones, when showAvailabilityFilter is true", () => {
    const { availableGames } = run({ availFilter: "soon" });
    expect(availableGames.map(g => g.id)).toEqual([comingSoon.id]);
  });

  test("availFilter 'soon' is ignored when showAvailabilityFilter is false", () => {
    const { availableGames } = run({ availFilter: "soon", showAvailabilityFilter: false });
    expect(availableGames.map(g => g.id)).not.toContain(comingSoon.id);
  });

  test("query matches label case-insensitively", () => {
    const { filtered } = run({ query: "impostor" });
    expect(filtered.map(g => g.id)).toEqual([destacado.id]);
  });

  test("query matches description case-insensitively", () => {
    const { filtered } = run({ query: "RULETA" });
    expect(filtered.map(g => g.id)).toEqual([rapido.id]);
  });

  test("grouped is null while a search query is active", () => {
    const { grouped } = run({ query: "impostor" });
    expect(grouped).toBeNull();
  });

  test("grouped follows CATEGORY_ORDER and drops empty sections", () => {
    const { grouped } = run();
    expect(grouped).not.toBeNull();
    const cats = grouped!.map(section => section.cat);
    expect(cats).toEqual(["destacados", "rapidos", "otros"]);
  });

  test("a game with no category falls into 'otros'", () => {
    const { grouped } = run();
    const otros = grouped!.find(section => section.cat === "otros");
    expect(otros?.items.map(g => g.id)).toContain(sinCategoria.id);
  });

  test("activeCat narrows grouped to a single category", () => {
    const { grouped } = run({ activeCat: "rapidos" });
    expect(grouped).toEqual([{ cat: "rapidos", items: [rapido] }]);
  });
});
