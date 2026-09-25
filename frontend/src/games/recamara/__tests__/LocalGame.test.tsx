import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocalGame } from "../LocalGame";

// Every round opens with the round overlay over the table (RoundOverlay):
// "RONDA N", the chamber's shells shown, flipped, shuffled and loaded, then
// it lifts by itself and the duel goes on underneath. Waits it out under
// fake timers.
async function waitOutRoundOverlay() {
  for (let i = 0; i < 20 && document.querySelector(".round-overlay"); i++) {
    await vi.advanceTimersByTimeAsync(1000);
  }
  if (document.querySelector(".round-overlay")) throw new Error("round overlay never lifted");
}

async function startGame(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Cargar la recámara" }));
  await waitOutRoundOverlay();
}

// One self-shot (always a legal target), played through its result banner.
async function selfShot(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Dispararme a mí" }));
  await vi.advanceTimersByTimeAsync(2000);
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

// Round 1 always plays with zero items (see createInitialState) — any test
// that needs a real item in hand has to first survive into round 2, which
// only happens once a reload empties the chamber.
async function playIntoRound2(user: ReturnType<typeof userEvent.setup>) {
  await startGame(user);
  for (let i = 0; i < 8 && !document.querySelector(".round-overlay"); i++) await selfShot(user);
  expect(screen.getByText("Ronda 2", { selector: ".round-overlay-title" })).toBeInTheDocument();
  await waitOutRoundOverlay();
}

describe("Recámara LocalGame", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("renders the setup screen with two default players", () => {
    render(<LocalGame />);
    expect(screen.getByDisplayValue("Jugador 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jugador 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cargar la recámara" })).toBeInTheDocument();
  });

  test("plays shots until the duel ends with the end screen", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LocalGame />);

    await startGame(user);
    expect(screen.getByText(/Te toca/)).toBeInTheDocument();
    expect(document.querySelector(".spent-shell")).not.toBeInTheDocument();

    for (let i = 0; i < 60; i++) {
      if (document.querySelector(".end-panel")) break;
      if (document.querySelector(".round-overlay")) {
        await waitOutRoundOverlay();
        continue;
      }
      await user.click(screen.getByRole("button", { name: "Dispararme a mí" }));
      // Wait out the aim + shot beats — nothing commits to game state until
      // the result banner is dismissed.
      await vi.advanceTimersByTimeAsync(2000);
      expect(document.querySelector(".spent-shell")).toBeInTheDocument();
      // The verdict in big letters, who shot whom above it.
      expect(document.querySelector(".result-banner-big")?.textContent).toMatch(/^(REAL|FALSA)$/);
      expect(document.querySelector(".result-banner-who")?.textContent).toMatch(/dispara/);
      await user.click(screen.getByRole("button", { name: "Continuar" }));
      // The end screen (if this was the fatal shot) fades in after a short
      // delay instead of popping immediately — see showWinner.
      await vi.advanceTimersByTimeAsync(1200);
    }

    expect(screen.getByRole("dialog", { name: /^Ganó / })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jugar de nuevo" })).toHaveFocus();
  }, 30000);

  test("each round opens with the overlay on the table: RONDA N, the real/falsa count, then the duel underneath", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LocalGame />);
    await user.click(screen.getByRole("button", { name: "Cargar la recámara" }));

    // The table is already there, under the overlay — no separate screens.
    expect(document.querySelector(".duel-scene")).toBeInTheDocument();
    expect(screen.getByText("Ronda 1", { selector: ".round-overlay-title" })).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(2000);
    expect(document.querySelector(".reload-legend")?.textContent).toMatch(/^\d+ reale?s? · \d+ falsas?$/);
    expect(screen.getByText("Memorizá. El orden va a ser secreto.")).toBeInTheDocument();
    // Can't shoot while the chamber is still being loaded.
    expect(screen.queryByRole("button", { name: "Dispararme a mí" })).not.toBeInTheDocument();

    await waitOutRoundOverlay();
    expect(screen.getByRole("button", { name: "Dispararme a mí" })).toBeInTheDocument();
    expect(screen.getByText(/Te toca/)).toBeInTheDocument();
  }, 20000);

  test("after a reload, the new items are dealt onto the cards once the overlay lifts", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LocalGame />);
    await playIntoRound2(user);

    expect(document.querySelectorAll(".token-items.dealt").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".item-tray .tray-item").length).toBe(2);
  }, 30000);

  test("on your turn a rival's card shoots them, and your own card opens your items", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LocalGame />);
    await playIntoRound2(user);

    const currentName = document.querySelector(".token.active .token-name")!.textContent!;
    const otherName = screen
      .getAllByText(/^Jugador \d$/, { selector: ".token-name" })
      .map(el => el.textContent)
      .find(n => n !== currentName)!;

    // A rival's card is a target: it's labeled as such and pulses.
    expect(screen.getByRole("button", { name: `Dispararle a ${otherName}` })).toHaveClass("targetable");

    // Your own card during your turn: items are clickable and open the modal.
    await user.click(screen.getByText(currentName, { selector: ".token-name" }));
    const myItemButtons = screen.getAllByRole("button").filter(b => b.className.includes("rec-sheet-item"));
    await user.click(myItemButtons[0]);
    expect(document.querySelector(".rec-modal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  }, 30000);

  test("the current player's items are in the tray below the table", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LocalGame />);
    await playIntoRound2(user);

    const itemButtons = document.querySelectorAll(".item-tray .tray-item");
    expect(itemButtons.length).toBe(2);
    await user.click(itemButtons[0] as HTMLButtonElement);
    expect(document.querySelector(".rec-modal")).toBeInTheDocument();
  }, 30000);

  test("the result banner moves on by itself if nobody taps", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LocalGame />);
    await startGame(user);

    await user.click(screen.getByRole("button", { name: "Dispararme a mí" }));
    await vi.advanceTimersByTimeAsync(2000);
    expect(document.querySelector(".result-banner")).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(3000);
    expect(document.querySelector(".result-banner")).not.toBeInTheDocument();
  }, 20000);
});
