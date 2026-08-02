import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoomPublicState, PublicPlayer } from "@juntada/shared-types";
import { RoundView } from "../RoundView";

function makePlayers(n: number): PublicPlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Jugador ${i + 1}`,
    ready: false,
    online: true,
    hasVoted: false,
  }));
}

function makeRoom(phase: string, roundOverrides: Record<string, unknown> = {}, players = makePlayers(3)): RoomPublicState {
  return {
    code: "TEST1",
    name: "Sala de prueba",
    hostId: "p1",
    gameType: "impostor",
    phase,
    players,
    maxPlayers: 16,
    groupCode: null,
    config: { writtenClues: false, clueTime: 90, discussionTime: 30, hintsEnabled: true },
    round: {
      categoryLabel: "Animales",
      impostors: ["p2"],
      clues: {},
      turnOrder: players.map(p => p.id),
      turnIndex: 0,
      votes: {},
      skipVotes: 0,
      skipVotesNeeded: 2,
      rerollCount: 0,
      timerEnd: null,
      discussionEnd: null,
      revoteCandidates: null,
      ...roundOverrides,
    },
    usedWords: {},
    roundHistory: [],
    chat: [],
  };
}

afterEach(() => vi.useRealTimers());

describe("Impostor RoundView — round phase", () => {
  test("a word reroll shows a brief 'cambiando de palabra' transition before the new word is usable", async () => {
    vi.useFakeTimers();
    const room = makeRoom("round");
    const { rerender } = render(
      <RoundView
        room={room}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={{ isImpostor: false, word: "Gato", hint: null }}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("Tocá para ver tu carta")).toBeInTheDocument();

    const rerolledRoom = makeRoom("round", { rerollCount: 1 });
    rerender(
      <RoundView
        room={rerolledRoom}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={{ isImpostor: false, word: "Perro", hint: null }}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("Cambiando de palabra...")).toBeInTheDocument();
    expect(screen.queryByText("Tocá para ver tu carta")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.queryByText("Cambiando de palabra...")).not.toBeInTheDocument();
    expect(screen.getByText("Tocá para ver tu carta")).toBeInTheDocument();
  });

  test("shows the innocent's secret word once the card is revealed", async () => {
    const user = userEvent.setup();
    render(
      <RoundView
        room={makeRoom("round")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={{ isImpostor: false, word: "Gato", hint: null }}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("Tocá para ver tu carta")).toBeInTheDocument();
    await user.click(screen.getByText("Tocá para ver tu carta"));
    expect(screen.getByText("Gato")).toBeInTheDocument();
  });

  test("shows '¡Eres el impostor!' and the hint instead of the word for the impostor", async () => {
    const user = userEvent.setup();
    render(
      <RoundView
        room={makeRoom("round")}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={{ id: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false }}
        myRole={{ isImpostor: true, hint: "Vive en el agua" }}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Tocá para ver tu carta"));
    expect(screen.getByText("¡Eres el impostor!")).toBeInTheDocument();
    expect(screen.getByText("Vive en el agua")).toBeInTheDocument();
  });

  test("never shows the category to the impostor or to innocents", () => {
    const room = makeRoom("round");
    room.config = { ...room.config, hintsEnabled: false };

    const { rerender } = render(
      <RoundView
        room={room}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={{ id: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false }}
        myRole={{ isImpostor: true, hint: null }}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );
    expect(screen.queryByText("Animales")).not.toBeInTheDocument();

    rerender(
      <RoundView
        room={room}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={{ isImpostor: false, word: "Gato", hint: null }}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );
    expect(screen.queryByText("Animales")).not.toBeInTheDocument();
    expect(screen.queryByText("CATEGORÍA")).not.toBeInTheDocument();
  });

  test("on your turn, confirming out loud sends an empty submit_clue", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("round")} // turnIndex 0 -> p1's turn
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={{ isImpostor: false, word: "Gato", hint: null }}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Empezar pistas" }));
    await user.click(screen.getByRole("button", { name: "Ya dije mi palabra" }));
    expect(send).toHaveBeenCalledWith({ type: "submit_clue", clue: "" });
  });

  test("players whose turn hasn't come up yet see a waiting message, not the input", async () => {
    const user = userEvent.setup();
    render(
      <RoundView
        room={makeRoom("round")} // turnIndex 0 -> p1's turn, not p2's
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={{ id: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false }}
        myRole={{ isImpostor: true, hint: null }}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Empezar pistas" }));
    expect(screen.getByText("Esperando a Jugador 1...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ya dije mi palabra" })).not.toBeInTheDocument();
  });

  test("a written-clue round requires typing a word before it can be sent, only on your turn", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    const room = makeRoom("round");
    room.config = { ...room.config, writtenClues: true };
    render(
      <RoundView
        room={room}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={{ isImpostor: false, word: "Gato", hint: null }}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Empezar pistas" }));
    expect(screen.getByRole("button", { name: "Enviar palabra" })).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Escribí tu palabra..."), "Maúlla");
    await user.click(screen.getByRole("button", { name: "Enviar palabra" }));

    expect(send).toHaveBeenCalledWith({ type: "submit_clue", clue: "Maúlla" });
  });
});

describe("Impostor RoundView — discussion phase", () => {
  test("marking ready to vote sends player_ready", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("discussion")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    expect(screen.getByText("Estado de jugadores")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Listo para votar" }));
    expect(send).toHaveBeenCalledWith({ type: "player_ready" });
  });
});

describe("Impostor RoundView — voting phase", () => {
  test("selecting a suspect and confirming sends a vote for that player", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("voting")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    // Can't suspect yourself — only Jugador 2/3 should be selectable.
    expect(screen.queryByRole("button", { name: /Jugador 1/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Jugador 2/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar voto" }));

    expect(send).toHaveBeenCalledWith({ type: "vote", suspectId: "p2" });
    expect(screen.getByText("Ya votaste — esperando a que confirmen los demás.")).toBeInTheDocument();
  });

  test("a tie limits the suspect list to just the revote candidates", () => {
    render(
      <RoundView
        room={makeRoom("voting", { revoteCandidates: ["p2", "p3"] })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("Hubo un empate")).toBeInTheDocument();
  });
});

describe("Impostor RoundView — result phase", () => {
  beforeEach(() => vi.useFakeTimers());

  test("reveals the outcome after the countdown, and the host can start a new round", async () => {
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("result", {
          eliminated: "p2",
          wasImpostor: true,
          impostors: ["p2"],
          votes: { p1: "p2", p3: "p2" },
          matchOver: true,
          winner: "innocents",
          matchEliminated: ["p2"],
        })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={{ word: "Gato", categoryLabel: "Animales" }}
        isHost={true}
        send={send}
      />,
    );

    // The countdown blocks the reveal for a few seconds by design.
    expect(screen.queryByText("quedó eliminado/a")).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    // Switch back to real timers before driving further interaction —
    // userEvent's own internal delays don't play well with fake ones.
    vi.useRealTimers();
    const user = userEvent.setup();

    // Two sequential overlays before the vote breakdown/next-match button:
    // who got eliminated/their role, then who won + the word.
    expect(screen.getByText("quedó eliminado/a")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Ganaron los inocentes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    // The word only shows once now, on the underlying result page (not
    // duplicated in the MatchOutcomeOverlay above) — same as LocalGame.
    expect(screen.getByText("Gato")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nueva partida" }));
    expect(send).toHaveBeenCalledWith({ type: "new_game" });
  });

  test("a non-decisive elimination lets the host continue the match instead of starting over", async () => {
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom(
          "result",
          {
            eliminated: "p2",
            wasImpostor: false,
            impostors: ["p3"],
            votes: { p1: "p2" },
            matchOver: false,
            winner: null,
            matchEliminated: ["p2"],
          },
          [
            { id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false },
            { id: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false },
            { id: "p3", name: "Jugador 3", ready: false, online: true, hasVoted: false },
            { id: "p4", name: "Jugador 4", ready: false, online: true, hasVoted: false },
          ],
        )}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={{ word: "Gato", categoryLabel: "Animales" }}
        isHost={true}
        send={send}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText("ERA INOCENTE")).toBeInTheDocument();
    expect(screen.queryByText("Impostores")).not.toBeInTheDocument(); // roster stays hidden mid-match

    vi.useRealTimers();
    const user = userEvent.setup();
    // Match isn't over — just the one elimination overlay, no outcome step.
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await user.click(screen.getByRole("button", { name: "Siguiente ronda" }));
    expect(send).toHaveBeenCalledWith({ type: "continue_round" });
  });

  test("non-host players see a waiting message instead of round controls", async () => {
    render(
      <RoundView
        room={makeRoom("result", {
          eliminated: "p2",
          wasImpostor: true,
          impostors: ["p2"],
          votes: {},
          matchOver: true,
          winner: "innocents",
          matchEliminated: ["p2"],
        })}
        me={{ playerId: "p3", roomCode: "TEST1" }}
        myPlayer={{ id: "p3", name: "Jugador 3", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={{ word: "Gato", categoryLabel: "Animales" }}
        isHost={false}
        send={vi.fn()}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    vi.useRealTimers();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Ganaron los inocentes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Esperando que el anfitrión inicie otra partida")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nueva partida" })).not.toBeInTheDocument();
  });
});
