import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Player } from "@juntada/recamara-engine";
import { ItemUseModal } from "../components/ItemUseModal";

const rival = (id: number, items: Player["items"]): Player => ({ id, name: `P${id}`, lives: 3, items, lastGrantedItems: [] });

const renderSteal = (opponents: Player[], onSteal = vi.fn()) => {
  render(
    <ItemUseModal
      item="🧤"
      opponents={opponents}
      onClose={vi.fn()}
      onUseSimple={vi.fn()}
      onSteal={onSteal}
      onStealNoTarget={vi.fn()}
      onCuff={vi.fn()}
      onCuffNoTarget={vi.fn()}
    />,
  );
  return onSteal;
};

describe("ItemUseModal — 🧤", () => {
  it("never offers another 🧤 to steal", () => {
    const onSteal = renderSteal([rival(1, ["🧤", "🚬"])]);
    fireEvent.click(screen.getByRole("button", { name: /P1/ }));
    expect(screen.queryByRole("button", { name: /Ladrón/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cigarrillo/ }));
    expect(onSteal).toHaveBeenCalledWith(1, "🚬");
  });

  it("a rival holding only 🧤 isn't a victim at all", () => {
    renderSteal([rival(1, ["🧤"]), rival(2, ["🔍"])]);
    expect(screen.queryByRole("button", { name: /P1/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /P2/ })).toHaveTextContent("(1 ítems)");
  });

  it("nobody with anything stealable → nothing to pick", () => {
    renderSteal([rival(1, ["🧤", "🧤"])]);
    expect(screen.getByText("Nadie tiene ítems para robar ahora mismo.")).toBeInTheDocument();
  });
});
