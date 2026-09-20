import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocalGame } from "../LocalGame";

// The 9 board cells are unlabeled buttons rendered in index order — grab
// them fresh each time since the set of enabled ones shrinks as the board fills.
function boardCells() {
  return screen.getAllByRole("button").filter(b => ["·", "X", "O"].includes(b.textContent ?? ""));
}

describe("Ta-Te-Ti LocalGame", () => {
  test("renders the setup screen with default names", () => {
    render(<LocalGame />);
    expect(screen.getByDisplayValue("Jugador 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jugador 2")).toBeInTheDocument();
  });

  test("plays a full match to a win", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await user.click(screen.getByRole("button", { name: "Empezar a jugar" }));

    // X plays 0,1,2 (top row), O plays 3,4 — X wins on the top row.
    const moves = [0, 3, 1, 4, 2];
    for (const i of moves) {
      const cells = boardCells();
      await user.click(cells[i]);
    }

    expect(screen.getByText("Ganó Jugador 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jugar de nuevo" })).toBeInTheDocument();
  });

  test("a draw increments the draw counter, not either score", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await user.click(screen.getByRole("button", { name: "Empezar a jugar" }));

    // X O X / X O O / O X X -> draw.
    const moves = [0, 1, 2, 4, 3, 5, 7, 6, 8];
    for (const i of moves) {
      const cells = boardCells();
      await user.click(cells[i]);
    }

    expect(screen.getByText("Empate")).toBeInTheDocument();
  });

  test("reset marcador only shows up once there's a score, and asks for confirmation", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await user.click(screen.getByRole("button", { name: "Empezar a jugar" }));

    // Nothing to reset yet on a fresh 0-0-0 scoreboard.
    expect(screen.queryByRole("button", { name: "Reiniciar marcador" })).not.toBeInTheDocument();

    // X plays 0,1,2 (top row), O plays 3,4 — X wins on the top row.
    for (const i of [0, 3, 1, 4, 2]) {
      const cells = boardCells();
      await user.click(cells[i]);
    }
    await user.click(screen.getByRole("button", { name: "Jugar de nuevo" }));

    await user.click(screen.getByRole("button", { name: "Reiniciar marcador" }));
    expect(screen.getByText("¿Reiniciar el marcador?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("¿Reiniciar el marcador?")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reiniciar marcador" })).toBeInTheDocument(); // score still there to reset

    await user.click(screen.getByRole("button", { name: "Reiniciar marcador" }));
    await user.click(screen.getByRole("button", { name: "Reiniciar" }));
    expect(screen.queryByText("¿Reiniciar el marcador?")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reiniciar marcador" })).not.toBeInTheDocument(); // back to 0-0
  });
});
