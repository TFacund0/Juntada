import { describe, test, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocalGame } from "./LocalGame";

async function addEntry(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(screen.getByPlaceholderText("Nombre (ej: Juan, o 'Prenda 1')"), name);
  await user.click(screen.getByRole("button", { name: "Agregar a la ruleta" }));
}

describe("Ruleta LocalGame", () => {
  test("disables starting the wheel below the 2-entry minimum", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    expect(screen.getByRole("button", { name: "Empezar a girar" })).toBeDisabled();

    await addEntry(user, "Juan");
    expect(screen.getByRole("button", { name: "Empezar a girar" })).toBeDisabled();

    await addEntry(user, "Ana");
    expect(screen.getByRole("button", { name: "Empezar a girar" })).toBeEnabled();
  });

  test("spinning reveals a result after the animation and lets you spin again in 'keep' mode", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);

    await user.type(screen.getByPlaceholderText("Nombre (ej: Juan, o 'Prenda 1')"), "Juan");
    await user.click(screen.getByRole("button", { name: "Agregar a la ruleta" }));
    await user.type(screen.getByPlaceholderText("Nombre (ej: Juan, o 'Prenda 1')"), "Ana");
    await user.click(screen.getByRole("button", { name: "Agregar a la ruleta" }));
    await user.click(screen.getByRole("button", { name: "Empezar a girar" }));

    await user.click(screen.getByRole("button", { name: "🎡 Girar la ruleta" }));
    expect(screen.getByRole("button", { name: "Girando..." })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Salió")).toBeInTheDocument(), { timeout: 6000 });
    expect(screen.getByRole("button", { name: "Girar de nuevo" })).toBeInTheDocument();
  }, 8000);

  test("eliminate mode removes the winner from the wheel and tracks elimination order", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);

    await user.type(screen.getByPlaceholderText("Nombre (ej: Juan, o 'Prenda 1')"), "Juan");
    await user.click(screen.getByRole("button", { name: "Agregar a la ruleta" }));
    await user.type(screen.getByPlaceholderText("Nombre (ej: Juan, o 'Prenda 1')"), "Ana");
    await user.click(screen.getByRole("button", { name: "Agregar a la ruleta" }));

    await user.click(screen.getByText(/Eliminación/));
    await user.click(screen.getByRole("button", { name: "Empezar a girar" }));

    await user.click(screen.getByRole("button", { name: "🎡 Girar la ruleta" }));
    await waitFor(() => expect(screen.getByText("Salió")).toBeInTheDocument(), { timeout: 6000 });

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Orden de eliminación")).toBeInTheDocument();
    expect(screen.getByText("Ganador")).toBeInTheDocument();
  }, 8000);
});
