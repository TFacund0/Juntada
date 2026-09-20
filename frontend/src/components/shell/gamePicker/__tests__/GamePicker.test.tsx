import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GamePicker } from "../GamePicker";
import type { GameDef } from "../../../../games/gameTypes";

// Minimal fixture — only the fields GamePicker/GameGrid/GameDetailDialog
// actually read; `LocalGame` is required by the GameDef contract but never
// rendered from this picker.
function makeGame(overrides: Partial<GameDef>): GameDef {
  return {
    id: "game-a",
    label: "Juego A",
    description: "La descripción del juego A",
    category: "destacados",
    LocalGame: () => null,
    ...overrides,
  } as GameDef;
}

const games: GameDef[] = [
  makeGame({ id: "game-a", label: "Juego A", description: "La descripción del primer juego", category: "destacados" }),
  makeGame({ id: "game-b", label: "Juego B", description: "La descripción del segundo juego", category: "rapidos" }),
];

describe("GamePicker", () => {
  test("renders category sections with games grouped by category", () => {
    render(<GamePicker games={games} onPick={() => {}} />);
    expect(screen.getByText("Juego A")).toBeInTheDocument();
    expect(screen.getByText("Juego B")).toBeInTheDocument();
  });

  test("search input filters to a single 'Resultados' section", () => {
    render(<GamePicker games={games} onPick={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Buscar juego…"), { target: { value: "Juego A" } });
    expect(screen.getByText("Resultados")).toBeInTheDocument();
    expect(screen.getByText("Juego A")).toBeInTheDocument();
    expect(screen.queryByText("Juego B")).not.toBeInTheDocument();
  });

  test("shows an empty-state message when no game matches the search", () => {
    render(<GamePicker games={games} onPick={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("Buscar juego…"), { target: { value: "no-existe" } });
    expect(screen.getByText(/No encontramos juegos que coincidan con/)).toBeInTheDocument();
  });

  test("showAvailabilityFilter=false hides the Disponibles/Próximamente tabs", () => {
    render(<GamePicker games={games} onPick={() => {}} showAvailabilityFilter={false} />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  test("clicking a card opens the detail dialog, and confirming calls onPick", () => {
    const onPick = vi.fn();
    render(<GamePicker games={games} onPick={onPick} />);
    fireEvent.click(screen.getByText("Juego A"));
    const startBtn = screen.getByRole("button", { name: /jugar/i });
    fireEvent.click(startBtn);
    expect(onPick).toHaveBeenCalledWith("game-a");
  });
});
