import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChestReveal } from "../components/ChestReveal";
import type { Player, ItemKind } from "@juntada/recamara-engine";

describe("ChestReveal", () => {
  const basePlayer: Player = {
    id: 0,
    name: "Facu",
    lives: 2,
    items: ["🔍", "🚬"],
    lastGrantedItems: ["🪚", "🔒"],
  };

  it("does not show inventory full warning when inventory is not at MAX_ITEMS even if total is 0", () => {
    const playerWithSpace: Player = {
      ...basePlayer,
      items: ["🔍"], // length 1 < MAX_ITEMS (5)
      lastGrantedItems: [],
    };

    render(<ChestReveal player={playerWithSpace} newItems={[]} revealedCount={0} onReveal={vi.fn()} />);

    expect(screen.queryByText(/Inventario lleno/i)).toBeNull();
    expect(screen.queryByText(/Inventario casi lleno/i)).toBeNull();
  });

  it("shows full warning when inventory is at MAX_ITEMS and total is 0", () => {
    const fullPlayer: Player = {
      ...basePlayer,
      items: ["🔍", "🚬", "🪚", "🔒", "🧤"], // length 5 === MAX_ITEMS
      lastGrantedItems: [],
    };

    render(<ChestReveal player={fullPlayer} newItems={[]} revealedCount={0} onReveal={vi.fn()} />);

    expect(screen.getByText(/Inventario lleno \(5\/5\) — no pudiste sumar ningún ítem nuevo/i)).toBeDefined();
  });

  it("shows capped items warning when inventory reached MAX_ITEMS but player received fewer than ITEMS_PER_RELOAD", () => {
    const cappedPlayer: Player = {
      ...basePlayer,
      items: ["🔍", "🚬", "🪚", "🔒", "🧤"], // 5 items total after receiving 1
      lastGrantedItems: ["🧤"],
    };

    render(<ChestReveal player={cappedPlayer} newItems={["🧤"]} revealedCount={1} onReveal={vi.fn()} />);

    expect(screen.getByText(/Inventario lleno \(5\/5\) — solo entró 1 de 2 ítems nuevos/i)).toBeDefined();
  });
});
