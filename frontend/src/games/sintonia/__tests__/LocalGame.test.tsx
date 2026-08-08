import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocalGame } from "../LocalGame";

// Plays one full local round end to end (setup -> roundSetup -> reveal
// [pick psychic -> psychic picks the spectrum -> reveal target] -> guessTurn
// -> result) with the 3 default players.

async function startRound(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Iniciar partida" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Confirmar y ver el objetivo" }));
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

    // The result view holds behind a few-second reveal countdown
    // (RevealCountdown/useRevealCountdown) before showing the actual
    // scores — findByText waits it out instead of asserting synchronously.
    // Default playMode is "endless", which shows only the scoreboard
    // (this round's own points included next to the running total) —
    // "Puntos de la ronda" is a separate block only shown in "rounds" mode.
    expect(await screen.findByText("Tabla de puntuación", {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente ronda" })).toBeInTheDocument();
  }, 8000);

  test("the psychic can type their own pair of concepts instead of a random one", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);

    await user.click(screen.getByRole("button", { name: "Iniciar partida" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Elegirlo yo mismo" }));
    expect(screen.getByRole("button", { name: "Confirmar y ver el objetivo" })).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Extremo izquierdo"), "Frío");
    await user.type(screen.getByPlaceholderText("Extremo derecho"), "Calor");
    await user.click(screen.getByRole("button", { name: "Confirmar y ver el objetivo" }));
    await user.click(screen.getByText("Tocá para revelar el objetivo"));

    expect(screen.getByText("Frío")).toBeInTheDocument();
    expect(screen.getByText("Calor")).toBeInTheDocument();
  });

  test("a written-clue round requires the clue text before proceeding", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);

    // The written-clue toggle lives under the "Configuración" tab, not the
    // default "Jugadores" one.
    await user.click(screen.getByRole("button", { name: "Configuración" }));
    await user.click(screen.getByText("Pistas dichas en voz alta"));
    await user.click(screen.getByRole("button", { name: "Jugadores" }));
    await startRound(user);
    await user.click(screen.getByText("Tocá para revelar el objetivo"));

    expect(screen.getByRole("button", { name: "Enviar pista y pasar a adivinar" })).toBeDisabled();
    await user.type(screen.getByPlaceholderText("Escribí tu pista..."), "Suave");
    expect(screen.getByRole("button", { name: "Enviar pista y pasar a adivinar" })).toBeEnabled();
  });
});
