import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocalGame } from "./LocalGame";

// Roulette assignment uses real setTimeout loops (18 spins), so these tests
// stick to manual team assignment to stay fast and deterministic.

async function goToAssignWithTwoPlayers(user: ReturnType<typeof userEvent.setup>) {
  // Trim the 4 default players down to 2, and turn off goal tracking so the
  // bracket phase uses the simple win/lose buttons instead of score inputs.
  await user.click(screen.getAllByRole("button", { name: "×" })[0]);
  await user.click(screen.getAllByRole("button", { name: "×" })[0]);
  await user.click(screen.getByText(/Contabilizar goles/));
  await user.click(screen.getByRole("button", { name: "Continuar a sorteo de equipos" }));
}

async function assignTeamsManually(user: ReturnType<typeof userEvent.setup>) {
  const chooseButtons = screen.getAllByRole("button", { name: "Elegir equipo" });
  await user.click(chooseButtons[0]);
  const firstTeamOption = screen.getAllByRole("button").find(b => b.textContent === "Argentina")!;
  await user.click(firstTeamOption);

  await user.click(screen.getByRole("button", { name: "Elegir equipo" }));
  const secondTeamOption = screen.getAllByRole("button").find(b => b.textContent === "Brasil")!;
  await user.click(secondTeamOption);
}

describe("Torneo de Fútbol LocalGame", () => {
  test("renders the setup screen with 4 default players and 8 default teams", () => {
    render(<LocalGame />);
    expect(screen.getByText("Jugadores (4)")).toBeInTheDocument();
    expect(screen.getByText(/Equipos disponibles \(8\)/)).toBeInTheDocument();
  });

  test("blocks continuing when there are fewer teams than players", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    // 8 default teams cover 4 players already; drop teams below the count.
    for (let i = 0; i < 7; i++) {
      await user.click(screen.getAllByText(/🏳️/)[0]);
    }
    expect(screen.getByRole("button", { name: "Continuar a sorteo de equipos" })).toBeDisabled();
  });

  test("plays a full 2-player tournament to a champion", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);

    await goToAssignWithTwoPlayers(user);
    await assignTeamsManually(user);

    await user.click(screen.getByRole("button", { name: "Continuar a armar los cruces" }));
    await user.click(screen.getByRole("button", { name: "Confirmar cruces y empezar torneo" }));

    await user.click(screen.getByRole("button", { name: "Cargar resultado" }));
    const winButtons = screen.getAllByRole("button", { name: /^Ganó /});
    await user.click(winButtons[0]);

    expect(screen.getByText("🏆")).toBeInTheDocument();
    expect(screen.getByText(/Campeón del torneo con/)).toBeInTheDocument();
  });
});
