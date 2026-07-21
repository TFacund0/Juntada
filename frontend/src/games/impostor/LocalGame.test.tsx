import { describe, test, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CATEGORIES } from "@juntada/impostor-data";
import { LocalGame } from "./LocalGame";

// Categories start off by default (the host has to actively pick some) — a
// round can't start with none active, so every test that needs to actually
// play a round picks the first one first.
async function enableFirstCategory(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Configuración" }));
  await user.click(screen.getByRole("button", { name: "Categorías" }));
  const firstLabel = Object.values(CATEGORIES)[0].label;
  await user.click(screen.getByText(firstLabel));
  await user.click(screen.getByRole("button", { name: "Jugadores" }));
}

// Plays one full local round end to end (setup -> reveal -> discussion ->
// vote -> result) with the 4 default players, driving the UI the same way a
// player would. Covers the state machine the component is built around, not
// just that it renders.

// 4 default players: reveal each one's card, then either "Siguiente
// jugador" or, on the last one, "Todos listos, empezar". Returns the
// revealed impostor's display name ("Jugador N") so a caller can vote
// deterministically instead of relying on chance — with numImpostors: 1
// and 4 players, eliminating anyone else leaves the match undecided (see
// engine.ts's tallyVotes parity rule), which is a real, valid outcome but
// not one these tests care to exercise.
async function revealAllPlayers(user: ReturnType<typeof userEvent.setup>): Promise<string> {
  let impostorName = "";
  for (let i = 0; i < 4; i++) {
    await user.click(screen.getByRole("button", { name: `Soy Jugador ${i + 1}, continuar` }));
    await user.click(screen.getByText("Tocá para revelar tu palabra"));
    if (screen.queryByText("Sos el impostor")) impostorName = `Jugador ${i + 1}`;
    const isLast = i === 3;
    await user.click(screen.getByRole("button", { name: isLast ? "Todos listos, empezar" : "Siguiente jugador" }));
  }
  return impostorName;
}

// Every voter (except the impostor themselves, who can't vote for their own
// name) votes for `targetName` — guarantees that player gets eliminated
// with no possibility of a tie among 4 voters, so the match's outcome is
// deterministic for tests that need one.
async function voteAllPlayers(user: ReturnType<typeof userEvent.setup>, targetName: string) {
  for (let i = 0; i < 4; i++) {
    const suspectButtons = screen.getAllByRole("button", { name: /^Jugador \d$/ });
    const target = suspectButtons.find(b => b.textContent === targetName) ?? suspectButtons[0];
    await user.click(target);
    const confirmButtons = screen.getAllByRole("button", { name: "Confirmar voto" });
    const enabled = confirmButtons.find(b => !b.hasAttribute("disabled"));
    expect(enabled).toBeDefined();
    await user.click(enabled!);
  }
}

// Each voter picks a different target (targetsByVoter[voterName] = suspect
// name), scoped to that voter's own card so a 2-2 tie can be set up on
// purpose instead of every voter piling onto the same suspect.
async function voteEach(user: ReturnType<typeof userEvent.setup>, targetsByVoter: Record<string, string>) {
  for (const [voterName, targetName] of Object.entries(targetsByVoter)) {
    const card = screen.getByText(`${voterName} sospecha de:`).closest("div")!.parentElement!;
    await user.click(within(card).getByRole("button", { name: targetName }));
    await user.click(within(card).getByRole("button", { name: "Confirmar voto" }));
  }
}

describe("Impostor LocalGame", () => {
  test("renders the setup screen with the 4 default players", () => {
    render(<LocalGame />);
    expect(screen.getByText("Jugadores (4)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jugador 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jugador 4")).toBeInTheDocument();
  });

  test("'Iniciar ronda' stays disabled until at least one category is picked, with a hint saying why", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    expect(screen.getByRole("button", { name: "Iniciar ronda" })).toBeDisabled();
    expect(screen.getByText('Elegí al menos una categoría en la pestaña "Categorías" para poder arrancar')).toBeInTheDocument();

    await enableFirstCategory(user);
    expect(screen.getByRole("button", { name: "Iniciar ronda" })).toBeEnabled();
    expect(screen.queryByText('Elegí al menos una categoría en la pestaña "Categorías" para poder arrancar')).not.toBeInTheDocument();
  });

  test("the 'Orden' tab lets the host reorder players, which drives the reveal order", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await enableFirstCategory(user);

    await user.click(screen.getByRole("button", { name: "Configuración" }));
    await user.click(screen.getByRole("button", { name: "Orden" }));
    const rows = screen.getAllByText(/^Jugador \d$/);
    expect(rows.map(r => r.textContent)).toEqual(["Jugador 1", "Jugador 2", "Jugador 3", "Jugador 4"]);

    // Move "Jugador 1" down one spot — it should now reveal second.
    const downButtons = screen.getAllByRole("button", { name: "↓" });
    await user.click(downButtons[0]);
    expect(screen.getAllByText(/^Jugador \d$/).map(r => r.textContent)).toEqual(["Jugador 2", "Jugador 1", "Jugador 3", "Jugador 4"]);

    await user.click(screen.getByRole("button", { name: "Jugadores" }));
    await user.click(screen.getByRole("button", { name: "Iniciar ronda" }));
    expect(screen.getByRole("button", { name: "Soy Jugador 2, continuar" })).toBeInTheDocument(); // reordered player now goes first
  });

  test("disables 'Iniciar ronda' below the 3-player minimum", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    const removeButtons = screen.getAllByRole("button", { name: "×" });
    await user.click(removeButtons[0]);
    await user.click(screen.getAllByRole("button", { name: "×" })[0]);

    expect(screen.getByRole("button", { name: "Iniciar ronda" })).toBeDisabled();
    expect(screen.getByText("Necesitás mínimo 3 jugadores")).toBeInTheDocument();
  });

  test("rejects adding a player with a name that's already taken", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await user.type(screen.getByPlaceholderText("Nombre"), "Jugador 1");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    expect(screen.getByText("Ya hay un jugador con ese nombre")).toBeInTheDocument();
    expect(screen.getByText("Jugadores (4)")).toBeInTheDocument(); // unchanged
  });

  test(
    "plays a full round from setup through result",
    async () => {
      const user = userEvent.setup();
      render(<LocalGame />);
      await enableFirstCategory(user);

      await user.click(screen.getByRole("button", { name: "Iniciar ronda" }));
      expect(screen.getByText("Jugador 1 de 4")).toBeInTheDocument();

      const impostorName = await revealAllPlayers(user);
      expect(screen.getByText("Pista para el impostor")).toBeInTheDocument(); // hintsEnabled defaults to true

      await user.click(screen.getByRole("button", { name: "Ir a votación" }));
      expect(screen.getByText("Faltan 4 confirmaciones")).toBeInTheDocument();

      // Every voter targets the impostor (revealed above), so with a single
      // impostor among 4 players this always ends the match — innocents win
      // the moment the last impostor is caught (see engine.ts's tallyVotes).
      await voteAllPlayers(user, impostorName);

      expect(screen.getByText("Ganaron los inocentes")).toBeInTheDocument();
      expect(screen.getByText("La palabra era")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Nueva partida" })).toBeInTheDocument();
    },
    15000,
  );

  // Reveal now needs an extra handoff-confirm tap per player, on top of an
  // already-heavy full round — pass an explicit longer timeout so this stays
  // reliable when the whole suite runs under parallel load, not just alone.
  test(
    "a tied vote triggers a revote among just the tied suspects instead of a random pick",
    async () => {
      const user = userEvent.setup();
      render(<LocalGame />);
      await enableFirstCategory(user);

      await user.click(screen.getByRole("button", { name: "Iniciar ronda" }));
      await revealAllPlayers(user);
      await user.click(screen.getByRole("button", { name: "Ir a votación" }));

      // Jugador 1 and Jugador 2 tie 2-2 (each gets one vote from the other,
      // plus one from Jugador 3/4 respectively).
      await voteEach(user, {
        "Jugador 1": "Jugador 2",
        "Jugador 2": "Jugador 1",
        "Jugador 3": "Jugador 1",
        "Jugador 4": "Jugador 2",
      });

      expect(screen.getByText("Hubo un empate")).toBeInTheDocument();
      expect(screen.getByText("Faltan 4 confirmaciones")).toBeInTheDocument(); // votes reset for the revote

      // The revote only offers the two tied suspects — Jugador 1/2 are forced
      // to vote each other (can't vote themselves), so Jugador 3 and 4 decide
      // it by both voting Jugador 1.
      await voteEach(user, {
        "Jugador 1": "Jugador 2",
        "Jugador 2": "Jugador 1",
        "Jugador 3": "Jugador 1",
        "Jugador 4": "Jugador 1",
      });

      expect(screen.queryByText("Hubo un empate")).not.toBeInTheDocument();
      expect(screen.getByText("quedó eliminado/a")).toBeInTheDocument(); // the tie got resolved into an actual elimination
    },
    15000,
  );

  test(
    "starting a new round from the result screen resets reveal/vote state",
    async () => {
      const user = userEvent.setup();
      render(<LocalGame />);
      await enableFirstCategory(user);

      await user.click(screen.getByRole("button", { name: "Iniciar ronda" }));
      const impostorName = await revealAllPlayers(user);
      await user.click(screen.getByRole("button", { name: "Ir a votación" }));
      await voteAllPlayers(user, impostorName);

      await user.click(screen.getByRole("button", { name: "Nueva partida" }));
      expect(screen.getByText("Jugador 1 de 4")).toBeInTheDocument();
    },
    15000,
  );
});
