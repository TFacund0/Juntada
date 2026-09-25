import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { Player } from "@juntada/recamara-engine";
import { ItemChest } from "../components/ItemChest";
import { RoundOverlay } from "../components/RoundOverlay";
import { localChests, ownChest } from "../utils/chests";
import { CHEST_DONE_AUTO_MS, CHEST_IDLE_MS } from "../utils/timing";

const player = (id: number, over: Partial<Player> = {}): Player => ({
  id,
  name: `P${id}`,
  lives: 3,
  items: ["🔍", "🚬"],
  lastGrantedItems: ["🔍", "🚬"],
  ...over,
});

describe("who gets a chest", () => {
  it("round 1 deals nothing, so nobody does", () => {
    expect(localChests(1, [0, 1], [player(0), player(1)])).toEqual([]);
    expect(ownChest(1, player(0))).toEqual([]);
  });

  it("local: every alive player who got something, in seating order", () => {
    const players = [player(0), player(1, { lives: 0 }), player(2, { lastGrantedItems: [], items: ["🔍"] }), player(3)];
    expect(localChests(2, [3, 2, 1, 0], players).map(c => c.ownerName)).toEqual(["P3", "P0"]);
  });

  it("a full inventory still gets one, to be told why it's empty", () => {
    const full = player(0, { items: ["🔍", "🚬", "🪚", "🔄", "🧤"], lastGrantedItems: [] });
    expect(localChests(2, [0], [full])).toEqual([{ ownerName: "P0", items: [], inventoryFull: true }]);
  });

  it("online: only my own, unnamed", () => {
    expect(ownChest(3, player(0))).toEqual([{ ownerName: null, items: ["🔍", "🚬"], inventoryFull: false }]);
    expect(ownChest(3, undefined)).toEqual([]);
  });
});

describe("ItemChest", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("one item per tap, each into its slot, then a tap moves on — once", () => {
    const onDone = vi.fn();
    render(<ItemChest ownerName="Ana" items={["🪚", "📞"]} inventoryFull={false} onDone={onDone} />);
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(document.querySelectorAll(".chest-slot.filled")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Abrir la caja, 0 de 2" }));
    expect(screen.getByText("Sierra", { selector: ".chest-prize-name" })).toBeInTheDocument();
    expect(document.querySelectorAll(".chest-slot.filled")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Abrir la caja, 1 de 2" }));
    expect(screen.getByText("Teléfono", { selector: ".chest-prize-name" })).toBeInTheDocument();
    expect(screen.getByText("pista sobre una bala futura")).toBeInTheDocument();
    expect(document.querySelector(".chest-box")).toHaveClass("open");
    expect(onDone).not.toHaveBeenCalled();

    const cont = screen.getByRole("button", { name: "Continuar" });
    fireEvent.click(cont);
    fireEvent.click(cont);
    act(() => void vi.advanceTimersByTime(CHEST_DONE_AUTO_MS));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("nobody tapping never holds the table up: it opens itself, then moves on", () => {
    const onDone = vi.fn();
    render(<ItemChest ownerName={null} items={["🔒"]} inventoryFull={false} onDone={onDone} />);
    expect(screen.getByText("Tu caja")).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(CHEST_IDLE_MS));
    expect(screen.getByText("Esposas", { selector: ".chest-prize-name" })).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(CHEST_DONE_AUTO_MS));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("a full inventory says why nothing (or less) came out", () => {
    render(<ItemChest ownerName="Ana" items={[]} inventoryFull onDone={vi.fn()} />);
    expect(screen.getByText(/Inventario lleno \(5\/5\): esta vez no entró ningún ítem/)).toBeInTheDocument();
  });
});

describe("RoundOverlay with chests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("the chests come after the shells, one player after the other, and only then it's done", () => {
    const onDone = vi.fn();
    render(
      <RoundOverlay
        roundNumber={2}
        liveCount={1}
        blankCount={1}
        chests={[
          { ownerName: "Ana", items: ["🔍"], inventoryFull: false },
          { ownerName: "Beto", items: ["🚬"], inventoryFull: false },
        ]}
        onDone={onDone}
      />,
    );
    expect(document.querySelector(".chest")).toBeNull();
    act(() => void vi.advanceTimersByTime(8000));
    expect(screen.getByText("Ana")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Abrir la caja, 0 de 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Beto")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Abrir la caja, 0 de 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    act(() => void vi.advanceTimersByTime(1000));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
