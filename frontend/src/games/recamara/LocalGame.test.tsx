import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocalGame } from "./LocalGame";

// Reveal now has four beats, each its own screen, in order: a plain "Ronda
// N" announcement (no button, moves on by itself after ~1.8s), one chest at
// a time per player ("Siguiente jugador"/"Ver la recámara", each requiring
// every item to be popped, and the handoff between two players plays its
// own ~800ms flash), the chamber card (gun + shell count, held up 5s), then
// a themed flash before the duel actually shows up. Click/wait through
// however many of those it takes. Pass fakeTimers: true when the test has
// vi.useFakeTimers() active, so those waits get advanced instead of really
// waited out.
async function clickThroughReveal(user: ReturnType<typeof userEvent.setup>, opts: { fakeTimers?: boolean } = {}) {
  const wait = async (ms: number) => {
    if (opts.fakeTimers) await vi.advanceTimersByTimeAsync(ms);
    else await new Promise(resolve => setTimeout(resolve, ms));
  };

  for (let i = 0; i < 20; i++) {
    const announcing = document.querySelector(".round-intro");
    if (announcing) {
      await wait(2000);
      continue;
    }
    const chest = document.querySelector(".chest-big:not(.empty)");
    if (chest) {
      await user.click(chest);
      continue;
    }
    const nextBtn = screen.queryByRole("button", { name: /Siguiente jugador|Ver la recámara/ });
    if (nextBtn) {
      await user.click(nextBtn);
      await wait(1000);
      continue;
    }
    const startBtn = screen.getByRole("button", { name: "Empezar a disparar" });
    await user.click(startBtn);
    await wait(1000);
    return;
  }
  throw new Error("clickThroughReveal: didn't reach the duel within 20 steps");
}

describe("Recámara LocalGame", () => {
  test("renders the setup screen with two default players", () => {
    render(<LocalGame />);
    expect(screen.getByDisplayValue("Jugador 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jugador 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cargar la recámara" })).toBeInTheDocument();
  });

  test("plays shots until the duel ends with a winner screen", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup();
    render(<LocalGame />);

    await user.click(screen.getByRole("button", { name: "Cargar la recámara" }));
    await clickThroughReveal(user, { fakeTimers: true });
    expect(screen.getByText(/Turno de/)).toBeInTheDocument();
    expect(document.querySelector(".last-shell")).not.toBeInTheDocument();

    for (let i = 0; i < 60; i++) {
      if (screen.queryByText(/Fin del duelo/)) break;
      if (document.querySelector(".round-intro, .round-chamber, .chest-stage")) {
        await clickThroughReveal(user, { fakeTimers: true });
        continue;
      }
      const btn = screen.getByRole("button", { name: "Dispararte a vos mismo" });
      await user.click(btn);
      // Wait out the aim + shot beats, then dismiss the result banner —
      // nothing commits to game state until "Continuar" is tapped.
      await vi.advanceTimersByTimeAsync(2000);
      expect(document.querySelector(".last-shell")).toBeInTheDocument();
      // The result banner is two lines: who-shot-whom on top, then the
      // real/falso verdict underneath in its own danger/safe color.
      expect(document.querySelector(".rec-banner-text")?.textContent).toMatch(/dispara/);
      expect(document.querySelector(".rec-banner-subtext")?.textContent).toMatch(/Cartucho (real|falso)/);
      await user.click(screen.getByRole("button", { name: "Continuar" }));
    }

    expect(screen.getByText(/Fin del duelo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jugar de nuevo" })).toBeInTheDocument();
    vi.useRealTimers();
  }, 20000);

  test("the reveal screen cycles one chest per player before the chamber card, popping one item per tap", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await user.click(screen.getByRole("button", { name: "Cargar la recámara" }));

    // Beat 1: the plain "Ronda 1" announcement, no button — it moves on by
    // itself shortly.
    expect(screen.getByText("1", { selector: ".round-intro-number" })).toBeInTheDocument();
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Beat 2: items — your own chest, nothing about the gun yet.
    expect(screen.getByText("Jugador 1", { selector: ".chest-title b" })).toBeInTheDocument();

    // The "next" button starts disabled until every item in this chest
    // has been popped one at a time.
    let nextBtn = screen.getByRole("button", { name: "Siguiente jugador" });
    expect(nextBtn).toBeDisabled();

    await user.click(document.querySelector(".chest-big")!);
    expect(document.querySelectorAll(".chest-collected-item")).toHaveLength(1);
    expect(nextBtn).toBeDisabled();

    await user.click(document.querySelector(".chest-big")!);
    expect(document.querySelectorAll(".chest-collected-item")).toHaveLength(2);
    nextBtn = screen.getByRole("button", { name: "Siguiente jugador" });
    expect(nextBtn).not.toBeDisabled();

    // Moving on plays a "Turno de X" handoff flash first, then lands on
    // player 2's own chest, freshly closed again.
    await user.click(nextBtn);
    expect(screen.getByText("Turno de Jugador 2")).toBeInTheDocument();
    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(screen.getByText("Jugador 2", { selector: ".chest-title b" })).toBeInTheDocument();
    expect(document.querySelectorAll(".chest-collected-item")).toHaveLength(0);

    // Finishing the last player's chest moves to beat 2: the chamber card
    // (gun + shuffled bullet icons + a visible countdown), only then "on to
    // the duel.
    await user.click(document.querySelector(".chest-big")!);
    await user.click(document.querySelector(".chest-big")!);
    const lastBtn = screen.getByRole("button", { name: "Ver la recámara" });
    await user.click(lastBtn);
    await new Promise(resolve => setTimeout(resolve, 1000));

    expect(document.querySelectorAll(".bullet-row span").length).toBeGreaterThan(0);
    expect(screen.getByText("Tiempo para mirar")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Empezar a disparar" }));
    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(screen.getByText(/Turno de/)).toBeInTheDocument();
  }, 15000);

  test("tapping a player opens a read-only items sheet, and your own item opens the use modal", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await user.click(screen.getByRole("button", { name: "Cargar la recámara" }));
    await clickThroughReveal(user);

    // Opening the *other* player's token is read-only: no clickable items.
    await user.click(screen.getByText("Jugador 2", { selector: ".token-name" }));
    expect(screen.getByText("Jugador 2", { selector: "b" })).toBeInTheDocument();
    const rivalItemButtons = screen.getAllByRole("button").filter(b => b.className.includes("rec-sheet-item"));
    expect(rivalItemButtons.every(b => (b as HTMLButtonElement).disabled)).toBe(true);
    await user.click(screen.getByTitle("Cerrar"));

    // Your own token during your turn: items are clickable and open the modal.
    await user.click(screen.getByText("Jugador 1", { selector: ".token-name" }));
    const myItemButtons = screen.getAllByRole("button").filter(b => b.className.includes("rec-sheet-item"));
    await user.click(myItemButtons[0]);
    expect(document.querySelector(".rec-modal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  }, 15000);

  test("the current player's items are always visible below the fire options", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await user.click(screen.getByRole("button", { name: "Cargar la recámara" }));
    await clickThroughReveal(user);

    const itemButtons = document.querySelectorAll(".your-items .item-btn");
    expect(itemButtons.length).toBe(2);
    await user.click(itemButtons[0] as HTMLButtonElement);
    expect(document.querySelector(".rec-modal")).toBeInTheDocument();
  }, 15000);
});
