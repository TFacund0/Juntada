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
    expect(screen.getByText(/Nombre/)).toBeInTheDocument();
  });

  test("drawing a letter shows it and the categories to fill in", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const user = userEvent.setup();
    render(<LocalGame />);

    await user.click(screen.getByRole("button", { name: "🎲 Sortear letra" }));

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🔀 Nueva letra" })).toBeInTheDocument();
    expect(screen.getByText('A completar con la "A"')).toBeInTheDocument();
  });

  test("disabling a category removes it from the 'to fill in' list", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);

    await user.click(screen.getByText(/Nombre/));
    await user.click(screen.getByRole("button", { name: "🎲 Sortear letra" }));

    const toFillCard = screen.getByText(/A completar con la/).closest("div")!;
    expect(toFillCard).not.toHaveTextContent("Nombre");
  });
});
