import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CATEGORIES } from "@juntada/impostor-data";
import { LocalGame } from "./LocalGame";

// Categories start off by default (the host has to actively pick some) — a
// round can't start with none active, so every test that needs to actually
// play a round picks the first one first.
async function enableFirstCategory(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Configuración" }));
  const firstLabel = Object.values(CATEGORIES)[0].label;
  await user.click(screen.getByText(firstLabel));
  await user.click(screen.getByRole("button", { name: "Jugadores" }));
}

// Plays one full local round end to end (setup -> reveal -> discussion ->
// vote -> result) with the 4 default players, driving the UI the same way a
// player would. Covers the state machine the component is built around, not
// just that it renders.

async function revealAllPlayers(user: ReturnType<typeof userEvent.setup>) {
  // 4 default players: reveal each one's card, then either "Siguiente
  // jugador" or, on the last one, "Todos listos, empezar".
  for (let i = 0; i < 4; i++) {
    await user.click(screen.getByText("Tocá para revelar tu palabra"));
    const isLast = i === 3;
    await user.click(screen.getByRole("button", { name: isLast ? "Todos listos, empezar" : "Siguiente jugador" }));
  }
}

async function voteAllPlayers(user: ReturnType<typeof userEvent.setup>) {
  // Cards render in player order and a voter's card (with its suspect
  // buttons) disappears once confirmed, so "the first suspect-name button
  // still in the DOM" always belongs to whichever voter hasn't gone yet.
  for (let i = 0; i < 4; i++) {
    const suspectButtons = screen.getAllByRole("button", { name: /^Jugador \d$/ });
    await user.click(suspectButtons[0]);
    const confirmButtons = screen.getAllByRole("button", { name: "Confirmar voto" });
    const enabled = confirmButtons.find(b => !b.hasAttribute("disabled"));
    expect(enabled).toBeDefined();
    await user.click(enabled!);
  }
}

describe("Impostor LocalGame", () => {
  test("renders the setup screen with the 4 default players", () => {
    render(<LocalGame />);
    expect(screen.getByText("Jugadores (4)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jugador 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jugador 4")).toBeInTheDocument();
  });

  test("'Iniciar ronda' stays disabled until at least one category is picked", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    expect(screen.getByRole("button", { name: "Iniciar ronda" })).toBeDisabled();

    await enableFirstCategory(user);
    expect(screen.getByRole("button", { name: "Iniciar ronda" })).toBeEnabled();
  });

  test("disables 'Iniciar ronda' below the 3-player minimum", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    const removeButtons = screen.getAllByRole("button", { name: "×" });
    await user.click(removeButtons[0]);
    await user.click(screen.getAllByRole("button", { name: "×" })[0]);

    expect(screen.getByRole("button", { name: "Iniciar ronda" })).toBeDisabled();
    expect(screen.getByText("Necesitás mínimo 3 jugadores")).toBeInTheDocument();
  });

  test("rejects adding a player with a name that's already taken", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await user.type(screen.getByPlaceholderText("Nombre"), "Jugador 1");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    expect(screen.getByText("Ya hay un jugador con ese nombre")).toBeInTheDocument();
    expect(screen.getByText("Jugadores (4)")).toBeInTheDocument(); // unchanged
  });

  test("plays a full round from setup through result", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await enableFirstCategory(user);

    await user.click(screen.getByRole("button", { name: "Iniciar ronda" }));
    expect(screen.getByText("Jugador 1 de 4")).toBeInTheDocument();

    await revealAllPlayers(user);
    expect(screen.getByText("Categoría de esta ronda")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ir a votación" }));
    expect(screen.getByText("Faltan 4 confirmaciones")).toBeInTheDocument();

    await voteAllPlayers(user);

    // Result phase: one of these two outcomes, plus the eliminated player and vote tally.
    const outcome = screen.queryByText("Impostor atrapado") ?? screen.queryByText("El impostor escapó");
    expect(outcome).not.toBeNull();
    expect(screen.getByText("La palabra era")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva ronda" })).toBeInTheDocument();
  });

  test("starting a new round from the result screen resets reveal/vote state", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await enableFirstCategory(user);

    await user.click(screen.getByRole("button", { name: "Iniciar ronda" }));
    await revealAllPlayers(user);
    await user.click(screen.getByRole("button", { name: "Ir a votación" }));
    await voteAllPlayers(user);

    await user.click(screen.getByRole("button", { name: "Nueva ronda" }));
    expect(screen.getByText("Jugador 1 de 4")).toBeInTheDocument();
  });
});
