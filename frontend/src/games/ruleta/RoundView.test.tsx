import { describe, test, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoomPublicState, PublicPlayer } from "@juntada/shared-types";
import { RoundView } from "./RoundView";

function makePlayers(): PublicPlayer[] {
  return [
    { id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false },
    { id: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false },
  ];
}

function makeEntries(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: `e${i}`, name: `Entrada ${i}`, description: "" }));
}

function makeRoom(phase: string, roundOverrides: Record<string, unknown> = {}, mode: "keep" | "eliminate" = "eliminate"): RoomPublicState {
  const entries = makeEntries(3);
  return {
    code: "TEST1",
    name: "Sala de prueba",
    hostId: "p1",
    gameType: "ruleta",
    phase,
    players: makePlayers(),
    maxPlayers: 16,
    groupCode: null,
    config: { entries, mode },
    round: {
      mode,
      entries,
      pool: entries,
      rotation: 0,
      result: null,
      spinAt: null,
      spinMs: 4200,
      eliminated: [],
      counts: {},
      ...roundOverrides,
    },
    usedWords: {},
    roundHistory: [],
  };
}

describe("Ruleta RoundView — spinning", () => {
  test("the host sees an enabled spin button, which sends 'spin'", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("round")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    const spinBtn = screen.getByRole("button", { name: /Girar la ruleta/ });
    expect(spinBtn).not.toBeDisabled();
    await user.click(spinBtn);
    expect(send).toHaveBeenCalledWith({ type: "spin" });
  });

  test("a non-host sees a waiting message instead of a spin button", () => {
    render(
      <RoundView
        room={makeRoom("round")}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={makePlayers()[1]}
        myRole={null}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Girar la ruleta/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Esperando que Jugador 1 gire la ruleta/)).toBeInTheDocument();
  });

  test("the spin button is disabled with fewer than 2 entries left in the pool", () => {
    render(
      <RoundView
        room={makeRoom("round", { pool: [makeEntries(1)[0]] })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Girar la ruleta/ })).toBeDisabled();
  });
});

describe("Ruleta RoundView — result banner", () => {
  // A fresh spinAt starts the component's own local "spinning" animation
  // (see RoundView.tsx's effect on round.spinAt) — the result banner only
  // shows once that finishes, spinMs (4200ms here) after mount, regardless
  // of the server timestamp itself.
  test("eliminate mode: the host sees a 'Continuar' button that confirms the elimination", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const send = vi.fn();
    const entries = makeEntries(3);
    render(
      <RoundView
        room={makeRoom("round", { result: entries[0], spinAt: 1, entries, pool: entries }, "eliminate")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(4200));

    expect(screen.getByText("Salió").nextElementSibling).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(send).toHaveBeenCalledWith({ type: "confirm_eliminate" });
    vi.useRealTimers();
  });

  test("keep mode: the host sees a 'Girar de nuevo' button that sends spin_again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const send = vi.fn();
    const entries = makeEntries(3);
    render(
      <RoundView
        room={makeRoom("round", { result: entries[1], spinAt: 1, entries, pool: entries }, "keep")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(4200));

    await user.click(screen.getByRole("button", { name: "Girar de nuevo" }));
    expect(send).toHaveBeenCalledWith({ type: "spin_again" });
    vi.useRealTimers();
  });

  test("a non-host sees the result but no action buttons", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const entries = makeEntries(3);
    render(
      <RoundView
        room={makeRoom("round", { result: entries[0], spinAt: 1, entries, pool: entries }, "eliminate")}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={makePlayers()[1]}
        myRole={null}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(4200));

    expect(screen.getByText("Salió").nextElementSibling).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continuar" })).not.toBeInTheDocument();
    expect(screen.getByText("Esperando al anfitrión")).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("Ruleta RoundView — finished", () => {
  test("room.phase 'result' shows the winner and, for the host, a 'Nueva partida' button", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    const winner = makeEntries(1)[0];
    render(
      <RoundView
        room={makeRoom("result", { pool: [winner], entries: makeEntries(3) }, "eliminate")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    expect(screen.getByText("Ganador").nextElementSibling).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nueva partida" }));
    expect(send).toHaveBeenCalledWith({ type: "new_game" });
  });

  test("a non-host doesn't see the 'Nueva partida' button", () => {
    render(
      <RoundView
        room={makeRoom("result", { pool: [makeEntries(1)[0]] }, "eliminate")}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={makePlayers()[1]}
        myRole={null}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Nueva partida" })).not.toBeInTheDocument();
  });
});

describe("Ruleta RoundView — elimination order / stats", () => {
  test("eliminate mode lists eliminated entries in order", () => {
    const entries = makeEntries(3);
    render(
      <RoundView
        room={makeRoom("round", { eliminated: [entries[0], entries[1]], pool: [entries[2]] }, "eliminate")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("Orden de eliminación")).toBeInTheDocument();
    expect(screen.getByText("Entrada 0")).toBeInTheDocument();
    expect(screen.getByText("Entrada 1")).toBeInTheDocument();
  });

  test("keep mode's stats collapsible expands to show per-entry counts", async () => {
    const user = userEvent.setup();
    const entries = makeEntries(2);
    render(
      <RoundView
        room={makeRoom("round", { entries, pool: entries, counts: { e0: 3, e1: 1 } }, "keep")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.queryByText("3×")).not.toBeInTheDocument();
    await user.click(screen.getByText("Ver cuántas veces salió cada opción"));
    expect(screen.getByText("3×")).toBeInTheDocument();
    expect(screen.getByText("1×")).toBeInTheDocument();
  });
});
