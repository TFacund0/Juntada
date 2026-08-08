import { describe, test, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocalGame } from "../LocalGame";

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
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(screen.getByText("Quedan 39 cartas en el mazo")).toBeInTheDocument();
  });

  test("'Revelar cartas' mode uses a 3-tap cycle per card (reveal, hide, advance) and confirms before ending early", async () => {
    const user = userEvent.setup();
    const { container } = render(<LocalGame />);
    await user.click(screen.getByRole("button", { name: "Configuración" }));
    await user.click(screen.getByRole("button", { name: "Revelar cartas" }));
    await user.click(screen.getByRole("button", { name: "Empezar a jugar" }));

    expect(screen.getByText(/Carta 1 de 40/)).toBeInTheDocument();
    expect(screen.getByText(/toquen para revelar/)).toBeInTheDocument();

    await user.click(clickDeck(container));
    expect(screen.getByText(/toquen para tapar/)).toBeInTheDocument();

    await user.click(clickDeck(container));
    expect(screen.getByText(/toquen para pasar a la siguiente/)).toBeInTheDocument();
    expect(screen.getByText(/Carta 1 de 40/)).toBeInTheDocument(); // still the same card

    // Only the 3rd tap slides the card away — that runs on a timer before
    // "Carta 2" shows up. The real animation is SLIDE_MS (350ms — see
    // LocalGame.tsx), but this timeout is generous because the full suite
    // runs many test files in parallel, and CPU contention under that load
    // can delay this specific test's event loop well past the real delay.
    await user.click(clickDeck(container));
    expect(await screen.findByText(/Carta 2 de 40/, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText(/toquen para revelar/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver puntaje" }));
    const manualCountsPanel = screen.getByText("Cartas de cada uno").parentElement as HTMLElement;
    const plusButtons = within(manualCountsPanel).getAllByRole("button", { name: "+" });
    await user.click(plusButtons[0]);
    await user.click(plusButtons[0]);
    expect(within(manualCountsPanel).getByText("2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Terminar partida" }));
    expect(screen.getByText("¿Terminar la partida?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("¿Terminar la partida?")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Terminar partida" }));
    await user.click(screen.getAllByRole("button", { name: "Terminar partida" })[1]);
    expect(screen.getByText("Partida terminada")).toBeInTheDocument();
    expect(screen.getByText("Cartas acumuladas")).toBeInTheDocument();
  });

  test("ending the match early asks for confirmation and shows the result", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await user.click(screen.getByRole("button", { name: "Empezar a jugar" }));

    await user.click(screen.getByRole("button", { name: "Terminar partida" }));
    expect(screen.getByText("¿Terminar la partida?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("¿Terminar la partida?")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Terminar partida" }));
    await user.click(screen.getAllByRole("button", { name: "Terminar partida" })[1]);
    expect(screen.getByText("Partida terminada")).toBeInTheDocument();
    expect(screen.getByText("Cartas acumuladas")).toBeInTheDocument();
  });
});
