import { describe, test, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CATEGORIES } from "@juntada/impostor-data";
import { LocalGame } from "../LocalGame";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

// Drives from "Empezar partida" through the intro screen and round-start
// flash (each with its own brief real-time delay before the next screen
// mounts — see IntroScreen/RoundStartFlash/LocalGame) and lands on the
// first player's reveal card.
async function startMatch(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Empezar partida" }));
  await user.click(screen.getByRole("button", { name: "Comenzar" }));
  await sleep(600); // IntroScreen's own fade-out before it calls onStart
  await sleep(1500); // RoundStartFlash's mount duration before reveal begins
}

// Reveals each of the 4 default players' cards in turn ("Siguiente
// jugador"/"Todos listos, seguimos", each advance has its own brief slide
// transition — see RevealScreen's handingOff timeout) and returns the
// revealed impostor's display name ("Jugador N") so a caller can vote
// deterministically instead of relying on chance — with numImpostors: 1
// and 4 players, eliminating anyone else leaves the match undecided (see
// engine.ts's tallyVotes parity rule), which is a real, valid outcome but
// not one these tests care to exercise.
async function revealAllPlayers(user: ReturnType<typeof userEvent.setup>): Promise<string> {
  let impostorName = "";
  for (let i = 0; i < 4; i++) {
    await user.click(screen.getByText("Tocá para ver tu carta"));
    if (screen.queryByText("¡Eres el impostor!")) impostorName = `Jugador ${i + 1}`;
    const isLast = i === 3;
    await user.click(screen.getByRole("button", { name: isLast ? "Todos listos, seguimos" : "Siguiente jugador" }));
    await sleep(350); // slide-out/slide-in handoff between turns
  }
  return impostorName;
}

// Past reveal (spoken clues by default — see LocalGame.config.writtenClues),
// the "A dar sus pistas" roster screen and the discussion phase both sit
// between reveal and voting; clicks through both to land on the vote screen.
async function goToVote(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Empezar discusión" }));
  await user.click(screen.getByRole("button", { name: "Empezar votación" }));
}

// Every voter (except the impostor themselves, who can't vote for their own
// name) votes for `targetName` — guarantees that player gets eliminated with
// no possibility of a tie among 4 voters, so the match's outcome is
// deterministic for tests that need one. By default also dismisses the two
// sequential reveal overlays that pop up once the vote resolves (who got
// eliminated, then — only if the match ended — who won/the word), landing
// on the underlying result screen (votes breakdown, "Nueva
// partida"/"Siguiente ronda") — pass dismissOverlay: false for a test that
// wants to inspect an overlay's own content first.
async function voteAllPlayers(user: ReturnType<typeof userEvent.setup>, targetName: string, dismissOverlay = true) {
  for (let i = 0; i < 4; i++) {
    // Whichever voter's card is still open, prefer voting for `targetName` —
    // except on the impostor's own turn, who can't vote for themselves, so
    // any other available suspect does (the match's outcome is already
    // decided by the other three votes at that point).
    const suspectButtons = screen.getAllByRole("button").filter(b => /^Jugador \d$/.test(b.getAttribute("aria-label") || ""));
    const target = suspectButtons.find(b => b.getAttribute("aria-label") === targetName) ?? suspectButtons[0];
    await user.click(target);
    const confirmButtons = screen.getAllByRole("button", { name: "Confirmar voto" });
    const enabled = confirmButtons.find(b => !b.hasAttribute("disabled"));
    expect(enabled).toBeDefined();
    await user.click(enabled!);
  }
  await sleep(1600); // VoteResultsFlash before the result phase actually mounts
  if (dismissOverlay) {
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    const outcomeContinue = screen.queryByRole("button", { name: "Continuar" });
    if (outcomeContinue) await user.click(outcomeContinue);
  }
}

// Each voter picks a different target (targetsByVoter[voterName] = suspect
// name), scoped to that voter's own card so a 2-2 tie can be set up on
// purpose instead of every voter piling onto the same suspect.
async function voteEach(user: ReturnType<typeof userEvent.setup>, targetsByVoter: Record<string, string>) {
  for (const [voterName, targetName] of Object.entries(targetsByVoter)) {
    const card = screen.getByText(`${voterName} sospecha de...`).closest("div")!.parentElement!;
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

  test("'Empezar partida' stays disabled until at least one category is picked, with a hint saying why", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    expect(screen.getByRole("button", { name: "Empezar partida" })).toBeDisabled();
    expect(screen.getByText('Elegí al menos una categoría en la pestaña "Categorías" para poder arrancar')).toBeInTheDocument();

    await enableFirstCategory(user);
    expect(screen.getByRole("button", { name: "Empezar partida" })).toBeEnabled();
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
    await startMatch(user);
    expect(screen.getByText("Jugador 2")).toBeInTheDocument(); // reordered player now goes first
    expect(screen.getByText("Jugador 1 de 4")).toBeInTheDocument();
  }, 20000);

  test("disables 'Empezar partida' below the 3-player minimum", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    const removeButtons = screen.getAllByRole("button", { name: "Eliminar jugador" });
    await user.click(removeButtons[0]);
    await user.click(screen.getAllByRole("button", { name: "Eliminar jugador" })[0]);

    expect(screen.getByRole("button", { name: "Empezar partida" })).toBeDisabled();
    expect(screen.getByText("Necesitás mínimo 3 jugadores")).toBeInTheDocument();
  });

  test("'+ Añadir jugador' adds a player with an auto-generated name", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await user.click(screen.getByRole("button", { name: "+ Añadir jugador" }));

    expect(screen.getByText("Jugadores (5)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jugador 5")).toBeInTheDocument();
  });

  test("plays a full round from setup through result", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await enableFirstCategory(user);
    await startMatch(user);
    expect(screen.getByText("Jugador 1 de 4")).toBeInTheDocument();

    const impostorName = await revealAllPlayers(user);
    await goToVote(user);

    // Every voter targets the impostor (revealed above), so with a single
    // impostor among 4 players this always ends the match — innocents win
    // the moment the last impostor is caught (see engine.ts's tallyVotes).
    await voteAllPlayers(user, impostorName, false);

    // Two sequential overlays before the underlying result screen becomes
    // reachable: who got eliminated/their role, then who won + the word.
    expect(screen.getByText("quedó eliminado/a")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Ganaron los inocentes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("¡Ganaron los inocentes!")).toBeInTheDocument();
    expect(screen.getByText(/La palabra era/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva partida" })).toBeInTheDocument();
  }, 25000);

  test("a tied vote triggers a revote among just the tied suspects instead of a random pick", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await enableFirstCategory(user);
    await startMatch(user);
    await revealAllPlayers(user);
    await goToVote(user);

    // Jugador 1 and Jugador 2 tie 2-2 (each gets one vote from the other,
    // plus one from Jugador 3/4 respectively).
    await voteEach(user, {
      "Jugador 1": "Jugador 2",
      "Jugador 2": "Jugador 1",
      "Jugador 3": "Jugador 1",
      "Jugador 4": "Jugador 2",
    });

    expect(screen.getByText("Hubo un empate")).toBeInTheDocument();

    // The revote only offers the two tied suspects — Jugador 1/2 are forced
    // to vote each other (can't vote themselves), so Jugador 3 and 4 decide
    // it by both voting Jugador 1.
    await voteEach(user, {
      "Jugador 1": "Jugador 2",
      "Jugador 2": "Jugador 1",
      "Jugador 3": "Jugador 1",
      "Jugador 4": "Jugador 1",
    });

    await sleep(1600); // VoteResultsFlash before the result phase actually mounts
    expect(screen.queryByText("Hubo un empate")).not.toBeInTheDocument();
    expect(screen.getByText("quedó eliminado/a")).toBeInTheDocument(); // the tie got resolved into an actual elimination
  }, 25000);

  test("'Nueva partida' from the result screen goes back to the players tab in setup", async () => {
    const user = userEvent.setup();
    render(<LocalGame />);
    await enableFirstCategory(user);
    await startMatch(user);
    const impostorName = await revealAllPlayers(user);
    await goToVote(user);
    await voteAllPlayers(user, impostorName);

    await user.click(screen.getByRole("button", { name: "Nueva partida" }));
    expect(screen.getByText("Jugadores (4)")).toBeInTheDocument();

    // Starting from there resets reveal/vote state for the next match.
    await startMatch(user);
    expect(screen.getByText("Jugador 1 de 4")).toBeInTheDocument();
  }, 25000);
});
