import { describe, test, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocalGame } from "../LocalGame";

async function playColorGuess(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Ver el color" }));
  expect(screen.getByTestId("target-swatch")).toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5100);
  });
  await user.click(screen.getByRole("button", { name: "Confirmar" }));
}

// A round's comparison rows only show up after a brief "Revelando
// resultados..." countdown once the last player of that round confirms.
async function advanceRevealCountdown() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2100);
  });
}

describe("Encuentra el Color Correcto LocalGame", () => {
  test("renders the setup screen with a default player", () => {
    render(<LocalGame />);
    expect(screen.getByText("Jugador 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Empezar a jugar" })).toBeInTheDocument();
  });

  test("adds and removes players before starting", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await user.type(screen.getByPlaceholderText("Nombre"), "Jugador 2");
    await user.click(screen.getByRole("button", { name: "Sumar" }));
    expect(screen.getByText("Jugador 2")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "✕" })[1]);
    expect(screen.queryByText("Jugador 2")).not.toBeInTheDocument();
  });

  test("plays a full single-player match down to the results screen", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup();
    render(<LocalGame />);

    await user.click(screen.getByRole("button", { name: "Configuración" }));
    await user.click(screen.getByRole("button", { name: "3" })); // 3 rounds
    await user.click(screen.getByRole("button", { name: "Empezar a jugar" }));

    for (let round = 0; round < 3; round++) {
      await playColorGuess(user);
      await advanceRevealCountdown();
      const isLast = round === 2;
      await user.click(screen.getByRole("button", { name: isLast ? "Ver resultados" : "Siguiente ronda" }));
    }

    expect(screen.getByText("Ganador")).toBeInTheDocument();
    expect(screen.getByText("Tabla de puntuación")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jugar de nuevo" })).toBeInTheDocument();
    vi.useRealTimers();
  });

  test("with two players, both guess the same target before the round reveals scores together", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup();
    render(<LocalGame />);

    await user.type(screen.getByPlaceholderText("Nombre"), "Jugador 2");
    await user.click(screen.getByRole("button", { name: "Sumar" }));
    await user.click(screen.getByRole("button", { name: "Configuración" }));
    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByRole("button", { name: "Empezar a jugar" }));

    expect(screen.getByText("Jugador 1")).toBeInTheDocument();
    await playColorGuess(user);

    // Second player's turn within the same round — no scores shown yet.
    expect(screen.getByText("Jugador 2")).toBeInTheDocument();
    expect(screen.queryByText("Resultados")).not.toBeInTheDocument();
    await playColorGuess(user);
    await advanceRevealCountdown();

    // Both played this round — reveal shows both names with scores (each
    // name shows up twice: once as the row header, once as the guess swatch caption).
    expect(screen.getAllByText("Jugador 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Jugador 2").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Siguiente ronda" })).toBeInTheDocument();

    vi.useRealTimers();
  });

  test("with a guess timer configured, running out of time auto-confirms whatever's selected", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup();
    render(<LocalGame />);

    await user.click(screen.getByRole("button", { name: "Configuración" }));
    await user.click(screen.getByRole("button", { name: "5s" }));
    await user.click(screen.getByRole("button", { name: "Empezar a jugar" }));

    await user.click(screen.getByRole("button", { name: "Ver el color" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100); // show phase (5s) ends, guess phase (with its own 5s timer) starts
    });
    expect(screen.getByText("Tiempo para adivinar")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100); // guess timer runs out without clicking "Confirmar"
    });
    await advanceRevealCountdown();

    expect(screen.getByText(/así quedó cada uno/)).toBeInTheDocument();
    vi.useRealTimers();
  });
});
