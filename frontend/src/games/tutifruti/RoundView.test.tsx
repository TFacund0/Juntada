import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

const CATS = [
  { id: "nombre", label: "Nombre", icon: "🧑" },
  { id: "color", label: "Color", icon: "🎨" },
];

function makeRoom(phase: string, roundOverrides: Record<string, unknown> = {}, players = makePlayers(2)): RoomPublicState {
  return {
    code: "TEST1",
    name: "Sala de prueba",
    hostId: "p1",
    gameType: "tutifruti",
    phase,
    players,
    maxPlayers: 16,
    groupCode: null,
    config: { score: {} },
    round: {
      letter: "A",
      rerollsUsed: 0,
      endMode: "timer",
      timerEnd: null,
      categories: CATS,
      doneCount: 0,
      answers: {},
      marks: {},
      reviewConfirmed: {},
      pointsByPlayer: {},
      breakdown: {},
      isFinalRound: false,
      ...roundOverrides,
    },
    usedWords: {},
    roundHistory: [],
  };
}

afterEach(() => vi.useRealTimers());

describe("Tutifrutti RoundView — setup phase", () => {
  test("the host can confirm the letter", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("setup")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    expect(screen.getByText("A")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar y empezar" }));
    expect(send).toHaveBeenCalledWith({ type: "confirm_letter" });
  });

  test("non-host players see a waiting message", () => {
    render(
      <RoundView
        room={makeRoom("setup")}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={{ id: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("Esperando que el anfitrión confirme la letra...")).toBeInTheDocument();
  });
});

describe("Tutifrutti RoundView — writing phase", () => {
  test("typing an answer eventually submits it", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("writing")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={{ myAnswers: {} }}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.type(screen.getAllByPlaceholderText("A...")[0], "Ana");

    await waitFor(() => {
      expect(send).toHaveBeenCalledWith({ type: "submit_answers", answers: { nombre: "Ana" } });
    });
  });

  test("clicking 'Ya terminé' right after typing flushes the pending answer instead of dropping it", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("writing")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={{ myAnswers: {} }}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    // Type and immediately confirm, faster than the 400ms submit debounce —
    // the last word typed must still make it out before player_ready.
    await user.type(screen.getAllByPlaceholderText("A...")[0], "Ana");
    await user.click(screen.getByRole("button", { name: "Ya terminé" }));

    const calls = send.mock.calls.map(c => c[0]);
    expect(calls).toContainEqual({ type: "submit_answers", answers: { nombre: "Ana" } });
    expect(calls).toContainEqual({ type: "player_ready" });
    expect(calls.indexOf(calls.find(c => c.type === "submit_answers")!)).toBeLessThan(
      calls.indexOf(calls.find(c => c.type === "player_ready")!),
    );
  });

  test("marking 'Ya terminé' locks the answer fields against further edits", () => {
    render(
      <RoundView
        room={makeRoom("writing")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: true, online: true, hasVoted: false }}
        myRole={{ myAnswers: { nombre: "Ana" } }}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.getAllByPlaceholderText("A...")[0]).toBeDisabled();
  });

  test("calling basta sends call_basta in basta mode", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("writing", { endMode: "basta" })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={{ myAnswers: {} }}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.click(screen.getByRole("button", { name: "¡BASTA!" }));
    // Asks for confirmation before actually cutting the round for everyone.
    await user.click(screen.getAllByRole("button", { name: "¡BASTA!" })[1]);
    expect(send).toHaveBeenCalledWith({ type: "call_basta" });
  });

  test("marking ready in timer mode sends player_ready", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("writing")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={{ myAnswers: {} }}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Ya terminé" }));
    expect(send).toHaveBeenCalledWith({ type: "player_ready" });
  });
});

describe("Tutifrutti RoundView — review phase", () => {
  test("marking a word valid sends mark_word", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("review", { answers: { p1: { nombre: "Ana" } } })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    expect(screen.getByText("Ana")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "✓" }));
    expect(send).toHaveBeenCalledWith({ type: "mark_word", targetPlayerId: "p1", categoryId: "nombre", valid: true });
  });

  test("confirming review sends confirm_review", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("review")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Confirmar puntajes/ }));
    expect(send).toHaveBeenCalledWith({ type: "confirm_review" });
  });
});

describe("Tutifrutti RoundView — result phase", () => {
  test("reveals standings instantly, and the host can start a new round", async () => {
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("result", { pointsByPlayer: { p1: 10, p2: 5 } }, makePlayers(2))}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    expect(screen.getByText("Clasificación")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Nueva ronda" }));
    expect(send).toHaveBeenCalledWith({ type: "start_round" });
  });

  test("'Volver al lobby' asks for confirmation before sending back_to_lobby", async () => {
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("result", { pointsByPlayer: { p1: 10, p2: 5 } }, makePlayers(2))}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Volver al lobby" }));
    expect(send).not.toHaveBeenCalledWith({ type: "back_to_lobby" });
    expect(screen.getByText("¿Volver al lobby?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("¿Volver al lobby?")).not.toBeInTheDocument();
    expect(send).not.toHaveBeenCalledWith({ type: "back_to_lobby" });

    await user.click(screen.getByRole("button", { name: "Volver al lobby" }));
    await user.click(screen.getAllByRole("button", { name: "Volver al lobby" })[1]);
    expect(send).toHaveBeenCalledWith({ type: "back_to_lobby" });
  });

  test("the final round shows the round result first, then a loading pause, then the final standings", async () => {
    render(
      <RoundView
        room={makeRoom("result", { pointsByPlayer: { p1: 10, p2: 5 }, isFinalRound: true })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("Puntos de la ronda")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nueva ronda" })).not.toBeInTheDocument();
    const showFinalBtn = screen.getByRole("button", { name: "Ver resultados finales" });

    const user = userEvent.setup();
    await user.click(showFinalBtn);

    expect(screen.getByText("Cargando resultados finales...")).toBeInTheDocument();

    expect(await screen.findByText("Fin del juego", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva partida" })).toBeInTheDocument();
  });
});
