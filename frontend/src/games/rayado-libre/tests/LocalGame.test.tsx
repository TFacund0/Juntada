import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { LocalGame } from "../LocalGame";

describe("Rayado Libre LocalGame", () => {
  test("renders the setup screen with the 3 default players and start enabled", () => {
    render(<LocalGame />);
    expect(screen.getByDisplayValue("Jugador 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jugador 2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jugador 3")).toBeInTheDocument();
    expect(screen.getByText("Empezar a jugar")).toBeEnabled();
  });

  test("disables 'Empezar a jugar' below the 3-player minimum", async () => {
    render(<LocalGame />);
    const user = userEvent.setup();
    const removeButtons = screen.getAllByText("×");
    await user.click(removeButtons[0]);
    expect(screen.getByText("Empezar a jugar")).toBeDisabled();
  });

  test("disables 'Empezar a jugar' when no category is active", async () => {
    render(<LocalGame />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Configuración"));
    await user.click(screen.getByText("Ninguna"));
    expect(screen.getByText("Empezar a jugar")).toBeDisabled();
  });

  test("plays a full turn: choose a word, mark every guesser correct, and reach the reveal", async () => {
    render(<LocalGame />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Empezar a jugar"));
    await user.click(screen.getByText(/Ya tengo el dispositivo/));

    const choicesCard = screen.getByText("Elegí qué vas a dibujar").parentElement as HTMLElement;
    const wordButtons = Array.from(choicesCard.querySelectorAll("button"));
    expect(wordButtons.length).toBe(3);
    await user.click(wordButtons[0]);

    expect(screen.getByText(/Tiempo para dibujar/)).toBeInTheDocument();
    const guessCard = screen.getByText("¿Quién acertó?").closest("div") as HTMLElement;
    const guessButtons = Array.from(guessCard.querySelectorAll("button"));
    // 2 non-drawer players out of 3 total.
    expect(guessButtons.length).toBe(2);
    for (const btn of guessButtons) await user.click(btn);

    expect(screen.getByText("La palabra era")).toBeInTheDocument();
    // No per-player ready vote in local mode (single shared device) — just
    // one button to move the whole table on to the next turn.
    expect(screen.getByText("Siguiente turno")).toBeInTheDocument();
  });

  test("tapping 'Siguiente turno' on the reveal screen moves straight to the next turn", async () => {
    render(<LocalGame />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Empezar a jugar"));
    await user.click(screen.getByText(/Ya tengo el dispositivo/));
    const choicesCard = screen.getByText("Elegí qué vas a dibujar").parentElement as HTMLElement;
    await user.click(choicesCard.querySelectorAll("button")[0]);
    const guessCard = screen.getByText("¿Quién acertó?").closest("div") as HTMLElement;
    for (const btn of Array.from(guessCard.querySelectorAll("button"))) await user.click(btn);

    expect(screen.getByText("La palabra era")).toBeInTheDocument();
    await user.click(screen.getByText("Siguiente turno"));
    expect(screen.queryByText("La palabra era")).not.toBeInTheDocument();
  });
});
