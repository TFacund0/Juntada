import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocalGame } from "./LocalGame";

async function fillWordsAndStart(user: ReturnType<typeof userEvent.setup>, words: string[]) {
  render(<LocalGame />);
  await user.click(screen.getByRole("button", { name: "Configuración" }));
  const inputs = screen.getAllByPlaceholderText("Ej: Messi, Bombero, Batman...");
  for (let i = 0; i < words.length; i++) {
    await user.type(inputs[i], words[i]);
  }
  await user.click(screen.getByRole("button", { name: "Empezar a jugar" }));
}

async function beginTurn(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Empezar mi turno" }));
}

describe("¿Quién Soy? LocalGame", () => {
  test("renders the setup screen with 3 default players", () => {
    render(<LocalGame />);
    expect(screen.getByDisplayValue("Jugador 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jugador 2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jugador 3")).toBeInTheDocument();
  });

  test("blocks starting until every player has a word written in", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    expect(screen.getByRole("button", { name: "Empezar a jugar" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Configuración" }));
    const inputs = screen.getAllByPlaceholderText("Ej: Messi, Bombero, Batman...");
    await user.type(inputs[0], "Messi");
    await user.type(inputs[1], "Batman");
    expect(screen.getByRole("button", { name: "Empezar a jugar" })).toBeDisabled();

    await user.type(inputs[2], "León");
    expect(screen.getByRole("button", { name: "Empezar a jugar" })).not.toBeDisabled();
  });

  test("words stay masked by default and can be revealed per-row", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await user.click(screen.getByRole("button", { name: "Configuración" }));
    const inputs = screen.getAllByPlaceholderText("Ej: Messi, Bombero, Batman...");
    expect(inputs[0]).toHaveAttribute("type", "password");

    await user.click(screen.getAllByRole("button", { name: "👁️" })[0]);
    expect(inputs[0]).toHaveAttribute("type", "text");
  });

  test("a full match where everyone concedes ends with all three marked as such", async () => {
    const user = userEvent.setup();
    await fillWordsAndStart(user, ["Messi", "Batman", "León"]);

    for (let i = 0; i < 3; i++) {
      await beginTurn(user);
      await user.click(screen.getByText("🏳️"));
      await user.click(screen.getByRole("button", { name: "Rendirme" }));
    }

    expect(screen.getByText("Resultados")).toBeInTheDocument();
    expect(screen.getAllByText(/Se rindió/).length).toBe(3);
    expect(screen.getByRole("button", { name: "Jugar de nuevo" })).toBeInTheDocument();
  });

  test("asking a question shows the turn circle and getting it answered (sí/no only) passes the turn", async () => {
    const user = userEvent.setup();
    await fillWordsAndStart(user, ["Messi", "Batman", "León"]);
    await beginTurn(user);

    expect(screen.getByText("Turno de")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Preguntar" }));
    await user.type(screen.getByPlaceholderText("¿Soy famoso?..."), "¿Soy un animal?");
    await user.click(screen.getByRole("button", { name: "Siguiente: que respondan" }));

    expect(screen.getByText(/Que agarre el dispositivo/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver la pregunta" }));
    expect(screen.getByText('"¿Soy un animal?"')).toBeInTheDocument();
    // Only sí/no, no comment field anymore.
    expect(screen.queryByPlaceholderText("Comentario opcional...")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sí" }));

    // Turn moved on — back at a handoff screen for the (rotated) next player.
    expect(screen.getByRole("button", { name: "Empezar mi turno" })).toBeInTheDocument();
  });

  test("correctly guessing your own word (case/accent-insensitive) solves the round", async () => {
    const user = userEvent.setup();
    await fillWordsAndStart(user, ["León", "Batman", "Águila"]);
    await beginTurn(user);

    await user.click(screen.getByRole("button", { name: "Adivinar" }));
    await user.type(screen.getByPlaceholderText("Escribí tu respuesta..."), "leon");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    // Solved player drops out of rotation — next handoff is a different player.
    expect(screen.getByRole("button", { name: "Empezar mi turno" })).toBeInTheDocument();
  });

  test("three wrong guesses in a row eliminate a player", async () => {
    const user = userEvent.setup();
    await fillWordsAndStart(user, ["Messi", "Batman", "León"]);

    const wrongGuess = async () => {
      await user.click(screen.getByRole("button", { name: "Adivinar" }));
      await user.type(screen.getByPlaceholderText("Escribí tu respuesta..."), "definitely not the word");
      await user.click(screen.getByRole("button", { name: "Confirmar" }));
    };

    await beginTurn(user);
    await wrongGuess();

    await beginTurn(user);
    await user.click(screen.getByText("🏳️"));
    await user.click(screen.getByRole("button", { name: "Rendirme" }));

    await beginTurn(user);
    await user.click(screen.getByText("🏳️"));
    await user.click(screen.getByRole("button", { name: "Rendirme" }));

    await beginTurn(user);
    await wrongGuess();
    await beginTurn(user);
    await wrongGuess();

    expect(screen.getByText("Resultados")).toBeInTheDocument();
    expect(screen.getByText(/Eliminado/)).toBeInTheDocument();
  });
});
