import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoomPublicState, PublicPlayer } from "@juntada/shared-types";
import { RoundView } from "./RoundView";

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

    expect(screen.getByText("Tocá para ver tu palabra")).toBeInTheDocument();

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
    expect(screen.queryByText("Tocá para ver tu palabra")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.queryByText("Cambiando de palabra...")).not.toBeInTheDocument();
    expect(screen.getByText("Tocá para ver tu palabra")).toBeInTheDocument();
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

    expect(screen.getByText("Tocá para ver tu palabra")).toBeInTheDocument();
    await user.click(screen.getByText("Tocá para ver tu palabra"));
    expect(screen.getByText("Gato")).toBeInTheDocument();
  });

  test("shows 'Sos el impostor' and the hint instead of the word for the impostor", async () => {
    const user = userEvent.setup();
    render(
      <RoundView
        room={makeRoom("round")}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={{ id: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false }}
        myRole={{ isImpostor: true, hint: "La categoría es Animales" }}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Tocá para ver tu palabra"));
    expect(screen.getByText("Sos el impostor")).toBeInTheDocument();
    expect(screen.getByText("La categoría es Animales")).toBeInTheDocument();
    expect(screen.getByText("PISTA PARA EL IMPOSTOR")).toBeInTheDocument();
  });

  test("hides the category from a blind impostor (hintsEnabled off), but not from innocents", () => {
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
    expect(screen.getByText("Animales")).toBeInTheDocument();
    expect(screen.getByText("CATEGORÍA")).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Ya dije mi palabra" }));
    expect(send).toHaveBeenCalledWith({ type: "submit_clue", clue: "" });
  });

  test("players whose turn hasn't come up yet see a waiting message, not the input", () => {
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

    expect(screen.getByText("Momento de pensar")).toBeInTheDocument();
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
    expect(screen.getByText("Voto confirmado. Esperando a los demás")).toBeInTheDocument();
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
    expect(screen.queryByText("Ganaron los inocentes")).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText("Ganaron los inocentes")).toBeInTheDocument();
    expect(screen.getByText("Gato")).toBeInTheDocument();

    // Switch back to real timers before driving further interaction —
    // userEvent's own internal delays don't play well with fake ones.
    vi.useRealTimers();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Nueva partida" }));
    expect(send).toHaveBeenCalledWith({ type: "start_round" });
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

    expect(screen.getByText("Ganaron los inocentes")).toBeInTheDocument();
    expect(screen.getByText("Esperando que el anfitrión inicie otra partida")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nueva partida" })).not.toBeInTheDocument();
  });
});
