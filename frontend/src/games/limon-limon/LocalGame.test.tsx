import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocalGame } from "./LocalGame";

// The deck/card is a plain clickable <div>, not a <button> — grab it by its
// distinctive inline cursor style instead of a role.
function clickDeck(container: HTMLElement) {
  const deck = container.querySelector('div[style*="cursor: pointer"]');
  expect(deck).toBeTruthy();
  return deck as HTMLElement;
}

describe("Limón Limón LocalGame", () => {
  test("renders the setup screen with the 3 default players and start enabled", () => {
    render(<LocalGame />);
    expect(screen.getByText("Jugadores (3)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Empezar a jugar" })).toBeEnabled();
  });

  test("disables 'Empezar a jugar' below the 2-player minimum", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await user.click(screen.getAllByRole("button", { name: "×" })[0]);
    await user.click(screen.getAllByRole("button", { name: "×" })[0]);

    expect(screen.getByRole("button", { name: "Empezar a jugar" })).toBeDisabled();
    expect(screen.getByText("Necesitás mínimo 2 jugadores")).toBeInTheDocument();
  });

  test("revealing a card lets the group assign it to a player, advancing the turn", async () => {
    const user = userEvent.setup();
    const { container } = render(<LocalGame />);
    await user.click(screen.getByRole("button", { name: "Empezar a jugar" }));

    expect(screen.getByText(/Turno de/)).toBeInTheDocument();
    await user.click(clickDeck(container));

    expect(screen.getByText("¿Quién se la queda?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Jugador 2/ }));

    expect(screen.getByText("Quedan 39 cartas en el mazo")).toBeInTheDocument();
  });

  test("voting to end early with a majority cuts the game short and shows the ranking", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await user.click(screen.getByRole("button", { name: "Empezar a jugar" }));

    await user.click(screen.getByRole("button", { name: /Terminar antes/ }));
    // 3 default players -> threshold is ceil(3/2) = 2 votes.
    await user.click(screen.getByRole("button", { name: /Jugador 1/ }));
    await user.click(screen.getByRole("button", { name: /Jugador 2/ }));

    expect(screen.getByText("Partida terminada por votación")).toBeInTheDocument();
    expect(screen.getByText("Cartas acumuladas")).toBeInTheDocument();
  });
});
