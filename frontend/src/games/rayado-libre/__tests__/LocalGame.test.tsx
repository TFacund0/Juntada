import { render, screen, within } from "@testing-library/react";
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

  test("disables 'Empezar a jugar' below the 2-player minimum", async () => {
    render(<LocalGame />);
    const user = userEvent.setup();
    const removeButtons = screen.getAllByText("×");
    await user.click(removeButtons[0]);
    await user.click(screen.getAllByText("×")[0]);
    expect(screen.getByText("Empezar a jugar")).toBeDisabled();
  });

  test("'Agregar' in the players card adds a player with the typed name", async () => {
    render(<LocalGame />);
    const user = userEvent.setup();
    const nameInput = screen.getByRole("textbox", { name: "Nombre del jugador nuevo" });
    await user.type(nameInput, "Tobi");
    await user.click(within(nameInput.parentElement as HTMLElement).getByText("Agregar"));
    expect(screen.getByDisplayValue("Tobi")).toBeInTheDocument();
    expect(nameInput).toHaveValue("");
  });

  test("disables 'Empezar a jugar' when no category is active", async () => {
    render(<LocalGame />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Configuración"));
    await user.click(screen.getByText("Ninguna"));
    expect(screen.getByText("Empezar a jugar")).toBeDisabled();
  });

  test("adding a custom word re-enables 'Empezar a jugar' even with every category off", async () => {
    render(<LocalGame />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Configuración"));
    await user.click(screen.getByText("Ninguna"));
    expect(screen.getByText("Empezar a jugar")).toBeDisabled();

    const wordInput = screen.getByPlaceholderText("Escribí una palabra o frase corta");
    await user.type(wordInput, "Chiste interno");
    // Players and config are both in the DOM (side by side from 900px), so scope to this "Agregar".
    await user.click(within(wordInput.parentElement as HTMLElement).getByText("Agregar"));
    expect(screen.getByText("Chiste interno")).toBeInTheDocument();
    expect(screen.getByText("Empezar a jugar")).toBeEnabled();
  });

  test("plays a full turn: choose a word, mark every guesser correct, and reach the reveal", async () => {
    render(<LocalGame />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Empezar a jugar"));
    await user.click(screen.getByText(/Ya tengo el dispositivo/));

    const choicesCard = screen.getByText("Elegí una palabra. Los demás no la ven.").parentElement as HTMLElement;
    const wordButtons = Array.from(choicesCard.querySelectorAll("button"));
    expect(wordButtons.length).toBe(3);
    await user.click(wordButtons[0]);

    expect(document.querySelector(".rl-circular-timer")).toBeInTheDocument();
    const guessCard = screen.getByText("¿Quién acertó?").closest("div") as HTMLElement;
    const guessButtons = Array.from(guessCard.querySelectorAll("button[data-fx-anchor]"));
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
    const choicesCard = screen.getByText("Elegí una palabra. Los demás no la ven.").parentElement as HTMLElement;
    await user.click(choicesCard.querySelectorAll("button")[0]);
    const guessCard = screen.getByText("¿Quién acertó?").closest("div") as HTMLElement;
    for (const btn of Array.from(guessCard.querySelectorAll("button[data-fx-anchor]"))) await user.click(btn);

    expect(screen.getByText("La palabra era")).toBeInTheDocument();
    await user.click(screen.getByText("Siguiente turno"));
    expect(screen.queryByText("La palabra era")).not.toBeInTheDocument();
  });

  test("the drawing screen has no 'Pedir otra palabra', and mute sits in the '¿Quién acertó?' header", async () => {
    render(<LocalGame />);
    const user = userEvent.setup();

    await user.click(screen.getByText("Empezar a jugar"));
    await user.click(screen.getByText(/Ya tengo el dispositivo/));
    const choicesCard = screen.getByText("Elegí una palabra. Los demás no la ven.").parentElement as HTMLElement;
    await user.click(choicesCard.querySelectorAll("button")[0]);

    expect(screen.queryByText(/Pedir otra palabra/)).not.toBeInTheDocument();
    const mute = screen.getByRole("button", { name: /Silenciar sonido|Activar sonido/ });
    expect(screen.getByRole("complementary", { name: "¿Quién acertó?" })).toContainElement(mute);
  });
});
