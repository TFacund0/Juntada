import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocalGame } from "./LocalGame";

// Plays one full local round end to end (setup -> roundSetup -> reveal ->
// guessTurn -> result) with the 3 default players.

async function startRound(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Iniciar partida" }));
  await user.click(screen.getByRole("button", { name: "Empezar ronda" }));
}

async function revealAndProceed(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Tocá para revelar el objetivo"));
  await user.click(screen.getByRole("button", { name: "Ya dije mi pista, pasar a adivinar" }));
}

async function guessAllPlayers(user: ReturnType<typeof userEvent.setup>) {
  // 2 non-psychic players by default (3 total players, 1 psychic).
  for (let i = 0; i < 2; i++) {
    const btn = screen.getByRole("button", { name: /Confirmar y/ });
    await user.click(btn);
  }
}

describe("Sintonía LocalGame", () => {
  test("renders the setup screen with the 3 default players and start enabled", () => {
    render(<LocalGame />);
    expect(screen.getByText("Jugadores (3)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jugador 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jugador 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar partida" })).toBeEnabled();
  });

  test("disables 'Iniciar partida' below the 2-player minimum", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await user.click(screen.getAllByRole("button", { name: "×" })[0]);
    await user.click(screen.getAllByRole("button", { name: "×" })[0]);

    expect(screen.getByRole("button", { name: "Iniciar partida" })).toBeDisabled();
    expect(screen.getByText("Necesitás mínimo 2 jugadores")).toBeInTheDocument();
  });

  test("rejects adding a player with a name that's already taken", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await user.type(screen.getByPlaceholderText("Nombre"), "Jugador 1");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    expect(screen.getByText("Ya hay un jugador con ese nombre")).toBeInTheDocument();
    expect(screen.getByText("Jugadores (3)")).toBeInTheDocument();
  });

  test("plays a full round from setup through result", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);

    await startRound(user);
    expect(screen.getByText("Pasále el dispositivo solo a esta persona")).toBeInTheDocument();

    await revealAndProceed(user);
    expect(screen.getByText(/Turno 1 de 2/)).toBeInTheDocument();

    await guessAllPlayers(user);

    expect(screen.getByText("Puntos de la ronda")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente ronda" })).toBeInTheDocument();
  });

  test("a written-clue round requires the clue text before proceeding", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);

    await user.click(screen.getByText("Pistas dichas en voz alta"));
    await startRound(user);
    await user.click(screen.getByText("Tocá para revelar el objetivo"));

    expect(screen.getByRole("button", { name: "Enviar pista y pasar a adivinar" })).toBeDisabled();
    await user.type(screen.getByPlaceholderText("Escribí tu pista..."), "Suave");
    expect(screen.getByRole("button", { name: "Enviar pista y pasar a adivinar" })).toBeEnabled();
  });
});
