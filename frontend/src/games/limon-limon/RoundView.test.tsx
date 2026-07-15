import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoomPublicState, PublicPlayer } from "@juntada/shared-types";
import { buildDefaultDescriptions } from "./deck";
import { RoundView } from "./RoundView";

function makePlayers(): PublicPlayer[] {
  return [
    { id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false },
    { id: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false },
  ];
}

function makeRoom(phase: string, roundOverrides: Record<string, unknown> = {}, configOverrides: Record<string, unknown> = {}): RoomPublicState {
  return {
    code: "TEST1",
    name: "Sala de prueba",
    hostId: "p1",
    gameType: "limon-limon",
    phase,
    players: makePlayers(),
    maxPlayers: 16,
    groupCode: null,
    config: { descriptions: buildDefaultDescriptions(), turnOrder: ["p1", "p2"], ...configOverrides },
    round: {
      order: ["p1", "p2"],
      turnId: "p1",
      current: null,
      remaining: 40,
      pileCounts: { p1: 0, p2: 0 },
      endVotes: [],
      endVoteThreshold: 1,
      ...roundOverrides,
    },
    usedWords: {},
    roundHistory: [],
  };
}

function clickDeck(container: HTMLElement) {
  const deck = container.querySelector('div[style*="cursor: pointer"]');
  expect(deck).toBeTruthy();
  return deck as HTMLElement;
}

afterEach(() => vi.useRealTimers());

describe("Limón Limón RoundView — round phase", () => {
  test("the current turn player can reveal the top card", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    const { container } = render(
      <RoundView
        room={makeRoom("round")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.click(clickDeck(container));
    expect(send).toHaveBeenCalledWith({ type: "reveal" });
  });

  test("assigning the current card to a player sends its id", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("round", { current: { suit: "oro", value: 1 } })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Jugador 2/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(send).toHaveBeenCalledWith({ type: "assign", targetId: "p2" });
  });

  test("non-turn players see a waiting message and can't assign", () => {
    render(
      <RoundView
        room={makeRoom("round", { current: { suit: "oro", value: 1 } })}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={{ id: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("Esperando que Jugador 1 reparta la carta")).toBeInTheDocument();
  });

  test("voting to end sends vote_end", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("round")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Terminar antes" }));
    await user.click(screen.getByRole("button", { name: "Votar para terminar" }));
    expect(send).toHaveBeenCalledWith({ type: "vote_end" });
  });
});

describe("Limón Limón RoundView — result phase", () => {
  beforeEach(() => vi.useFakeTimers());

  test("reveals the ranking after the countdown, and the host can start a new round", async () => {
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("result", { remaining: 0, pileCounts: { p1: 3, p2: 1 } })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    expect(screen.queryByText("Se acabó el mazo")).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText("Se acabó el mazo")).toBeInTheDocument();

    vi.useRealTimers();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Jugar de nuevo" }));
    expect(send).toHaveBeenCalledWith({ type: "start_round" });
  });

  test("non-host players see a waiting message instead of round controls", async () => {
    render(
      <RoundView
        room={makeRoom("result", { remaining: 0, pileCounts: { p1: 3, p2: 1 } })}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={{ id: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText("Esperando que el anfitrión inicie otra partida")).toBeInTheDocument();
  });
});
