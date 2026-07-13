import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocalGame } from "./LocalGame";

afterEach(() => vi.restoreAllMocks());

describe("Tutifrutti LocalGame", () => {
  test("renders the initial 'draw a letter' prompt with categories listed", () => {
    render(<LocalGame />);
    expect(screen.getByText("Tocá para sortear una letra")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🎲 Sortear letra" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nombre/ })).toBeInTheDocument();
  });

  test("the active categories show right under the letter, even before drawing", () => {
    render(<LocalGame />);
    const letterCard = screen.getByText("?").closest("div")!;
    expect(letterCard).toHaveTextContent("Nombre");
  });

  test("drawing a letter shows it alongside the active categories", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = userEvent.setup();
    render(<LocalGame />);

    await user.click(screen.getByRole("button", { name: "🎲 Sortear letra" }));

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🔀 Nueva letra" })).toBeInTheDocument();
    const letterCard = screen.getByText("A").closest("div")!;
    expect(letterCard).toHaveTextContent("Nombre");
  });

  test("disabling a category removes it from the letter card", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);

    await user.click(screen.getByRole("button", { name: /Nombre/ }));
    await user.click(screen.getByRole("button", { name: "🎲 Sortear letra" }));

    const letterCard = screen.getByText("La letra es...").closest("div")!;
    expect(letterCard).not.toHaveTextContent("Nombre");
  });
});
