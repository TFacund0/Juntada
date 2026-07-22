import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { LocalGame } from "./LocalGame";

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
    expect(screen.getByText("Todos listos para seguir")).toBeInTheDocument();
  });

  test("reveal only advances to the next turn once every player taps ready", async () => {
    render(<LocalGame />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Empezar a jugar"));
    await user.click(screen.getByText(/Ya tengo el dispositivo/));
    const choicesCard = screen.getByText("Elegí qué vas a dibujar").parentElement as HTMLElement;
    await user.click(choicesCard.querySelectorAll("button")[0]);
    await user.click(screen.getByText("Nadie más adivinó, terminar turno"));

    expect(screen.getByText("La palabra era")).toBeInTheDocument();
    const readyCard = screen.getByText("Todos listos para seguir").closest("div") as HTMLElement;
    const readyButtons = Array.from(readyCard.querySelectorAll("button"));
    expect(readyButtons.length).toBe(3);

    await user.click(readyButtons[0]);
    expect(screen.getByText("La palabra era")).toBeInTheDocument(); // still on reveal
    await user.click(readyButtons[1]);
    expect(screen.getByText("La palabra era")).toBeInTheDocument(); // still on reveal

    await user.click(readyButtons[2]);
    // Every player confirmed — moved on to the next turn (back to wordReveal
    // or straight to a new choosing screen).
    expect(screen.queryByText("Todos listos para seguir")).not.toBeInTheDocument();
  });
});
