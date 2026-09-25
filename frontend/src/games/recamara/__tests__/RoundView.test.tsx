import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoomPublicState, PublicPlayer } from "@juntada/shared-types";
import { RoundView } from "../RoundView";

function makePlayers(): PublicPlayer[] {
  return [
    { id: "p1", accountId: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false },
    { id: "p2", accountId: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false },
  ];
}

// Mirrors backend/src/games/recamara/engine.ts's getPublicRoundView.
function makeRound(overrides: Record<string, unknown> = {}) {
  return {
    seatOrder: ["p1", "p2"],
    state: {
      players: [
        { id: 0, name: "Jugador 1", lives: 5, items: ["🔍", "🚬"], lastGrantedItems: ["🔍", "🚬"] },
        { id: 1, name: "Jugador 2", lives: 5, items: ["🪚", "🔄"], lastGrantedItems: ["🪚", "🔄"] },
      ],
      order: [0, 1],
      direction: 1,
      turnPos: 0,
      shells: [
        { kind: null, spent: false, revealed: false },
        { kind: null, spent: false, revealed: false },
        { kind: null, spent: false, revealed: false },
        { kind: null, spent: false, revealed: false },
      ],
      idx: 0,
      sawedOff: false,
    },
    liveCount: 2,
    blankCount: 2,
    subPhase: "reveal",
    roundNumber: 1,
    readyForDuel: [],
    pendingFire: null,
    lastItemEvent: null,
    log: [],
    winnerRoomId: null,
    ...overrides,
  };
}

function makeRoom(roundOverrides: Record<string, unknown> = {}): RoomPublicState {
  return {
    code: "TEST1",
    name: "Sala de prueba",
    hostId: "p1",
    gameType: "recamara",
    phase: "playing",
    players: makePlayers(),
    maxPlayers: 6,
    groupCode: null,
    config: {},
    round: makeRound(roundOverrides),
    usedWords: {},
    roundHistory: [],
    chat: [],
  };
}

const meP1 = { playerId: "p1", roomCode: "TEST1" };
const myPlayerP1: PublicPlayer = { id: "p1", accountId: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false };

describe("Recámara RoundView — reveal", () => {
  test("round 1 has no items to reveal — skips straight from the announcement to the chamber card, with the bullet legend", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const send = vi.fn();
    const noItemsState = { ...makeRound().state, players: makeRound().state.players.map(p => ({ ...p, items: [] })) };
    render(
      <RoundView
        room={makeRoom({ state: noItemsState })}
        me={meP1}
        myPlayer={myPlayerP1}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    expect(screen.getByText("1", { selector: ".round-intro-number" })).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(2000);

    // No chest beat at all — nothing to reveal in round 1.
    expect(document.querySelector(".chest-stage")).not.toBeInTheDocument();
    expect(document.querySelector(".chamber-focus")).toBeInTheDocument();
    expect(document.querySelectorAll(".bullet-row span")).toHaveLength(4);
    expect(screen.getByText("🔴 real · 🟡 falsa")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Listo, a disparar" }));
    expect(send).toHaveBeenCalledWith({ type: "ready_for_duel" });
    vi.useRealTimers();
  });

  test("round 2+: the announcement moves on by itself, then my own chest, then the chamber card with liveCount+blankCount bullet icons, no legend", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const send = vi.fn();
    const { rerender } = render(
      <RoundView
        room={makeRoom({ roundNumber: 2 })}
        me={meP1}
        myPlayer={myPlayerP1}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    expect(screen.getByText("2", { selector: ".round-intro-number" })).toBeInTheDocument();
    expect(document.querySelector(".chamber-focus")).not.toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(2000);

    // My own chest — pop both items before "Ver la recámara" enables.
    const user = userEvent.setup();
    let nextBtn = screen.getByRole("button", { name: "Ver la recámara" });
    expect(nextBtn).toBeDisabled();
    await user.click(document.querySelector(".chest-big")!);
    await user.click(document.querySelector(".chest-big")!);
    nextBtn = screen.getByRole("button", { name: "Ver la recámara" });
    expect(nextBtn).not.toBeDisabled();
    await user.click(nextBtn);

    // The chamber card: gun + one 🔴/🟡 icon per shell (liveCount + blankCount),
    // never the numeric "2 reales" text, and no legend — round 1 already
    // showed it.
    expect(document.querySelector(".chamber-focus")).toBeInTheDocument();
    expect(document.querySelectorAll(".bullet-row span")).toHaveLength(4);
    expect(screen.queryByText(/reales/)).not.toBeInTheDocument();
    expect(screen.queryByText("🔴 real · 🟡 falsa")).not.toBeInTheDocument();
    expect(screen.getByText("Tiempo para mirar")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Listo, a disparar" }));
    expect(send).toHaveBeenCalledWith({ type: "ready_for_duel" });

    // Re-rendering with readyForDuel reflecting just me shows the waiting screen.
    rerender(
      <RoundView
        room={makeRoom({ roundNumber: 2, readyForDuel: ["p1"] })}
        me={meP1}
        myPlayer={myPlayerP1}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );
    expect(screen.getByText("Esperando a los demás")).toBeInTheDocument();
    vi.useRealTimers();
  });

  test("the chamber card also auto-advances (sends ready_for_duel) after its own countdown", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom({ roundNumber: 2, readyForDuel: [] })}
        me={meP1}
        myPlayer={myPlayerP1}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );
    await vi.advanceTimersByTimeAsync(2000);

    const user = userEvent.setup();
    await user.click(document.querySelector(".chest-big")!);
    await user.click(document.querySelector(".chest-big")!);
    await user.click(screen.getByRole("button", { name: "Ver la recámara" }));

    expect(document.querySelector(".chamber-focus")).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(5200);
    expect(send).toHaveBeenCalledWith({ type: "ready_for_duel" });
    vi.useRealTimers();
  });
});

describe("Recámara RoundView — duel", () => {
  function duelRoom(overrides: Record<string, unknown> = {}) {
    return makeRoom({ subPhase: "duel", readyForDuel: [], ...overrides });
  }

  test("on my turn, firing at myself sends the fire action with my own room id as the target", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(<RoundView room={duelRoom()} me={meP1} myPlayer={myPlayerP1} myRole={null} wordReveal={null} isHost={true} send={send} />);

    expect(screen.getByText(/Te toca/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dispararme a mí" }));
    expect(send).toHaveBeenCalledWith({ type: "fire", targetId: "p1" });
  });

  test("it's not my turn: fire controls are hidden, rivals aren't targets, and the status says whose turn it is", () => {
    render(
      <RoundView
        room={duelRoom({ state: { ...makeRound().state, turnPos: 1 } })}
        me={meP1}
        myPlayer={myPlayerP1}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Dispararme a mí" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Dispararle a/ })).not.toBeInTheDocument();
    expect(document.querySelector(".scene-status")).toHaveTextContent("Turno de Jugador 2…");
  });

  test("a pending fire event plays out the aim/shot/banner sequence before the real post-shot state shows", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const send = vi.fn();
    const { rerender } = render(
      <RoundView room={duelRoom()} me={meP1} myPlayer={myPlayerP1} myRole={null} wordReveal={null} isHost={true} send={send} />,
    );
    // Let the "keep settled state current" effect flush before the shot
    // lands — in real usage there's always a gap here (the player has to
    // actually pick a target and the round-trip takes time).
    await vi.advanceTimersByTimeAsync(0);

    // Server already resolved the shot — turn passed to p2 and p1 took a hit —
    // but the client should still show the pre-shot state while animating.
    const postShotRound = makeRound({
      subPhase: "duel",
      state: {
        ...makeRound().state,
        turnPos: 1,
        players: [
          { id: 0, name: "Jugador 1", lives: 4, items: ["🔍", "🚬"] },
          { id: 1, name: "Jugador 2", lives: 5, items: ["🪚", "🔄"] },
        ],
      },
      pendingFire: {
        seq: 1,
        shooterId: "p2",
        targetId: "p1",
        shellKind: "live",
        damage: 1,
        gameOver: false,
        winnerId: null,
        reloaded: false,
      },
    });
    rerender(
      <RoundView
        room={{ ...makeRoom(), round: postShotRound }}
        me={meP1}
        myPlayer={myPlayerP1}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    // Still mid-animation — the real turnPos/lives haven't visibly applied
    // yet (pre-shot it was p1's/"vos" turn, not p2's).
    expect(document.querySelector(".token.active")).toHaveTextContent("Vos");

    await vi.advanceTimersByTimeAsync(2000);
    expect(document.querySelector(".rec-banner-text")?.textContent).toMatch(/dispara/);
    expect(document.querySelector(".rec-banner-subtext")?.textContent).toMatch(/Cartucho real/);

    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole("button", { name: "Continuar" }));
    expect(document.querySelector(".scene-status")).toHaveTextContent("Turno de Jugador 2…");
    vi.useRealTimers();
  });

  // p1 = me ("Vos"), p2 = "Jugador 2". Each shot's round carries the state
  // right after that shot, exactly like the server's broadcasts do.
  function shotRound(seq: number, shooterId: string, targetId: string, lives: [number, number], turnPos: number) {
    return makeRound({
      subPhase: "duel",
      state: {
        ...makeRound().state,
        turnPos,
        players: [
          { id: 0, name: "Jugador 1", lives: lives[0], items: [], lastGrantedItems: [] },
          { id: 1, name: "Jugador 2", lives: lives[1], items: [], lastGrantedItems: [] },
        ],
      },
      pendingFire: {
        seq,
        shooterId,
        targetId,
        shellKind: "live",
        damage: 1,
        gameOver: false,
        winnerId: null,
        reloaded: false,
        skippedIds: [],
      },
    });
  }

  const livesOf = (name: string) =>
    screen
      .getAllByRole("button")
      .find(b => b.classList.contains("token") && b.textContent?.includes(name))
      ?.querySelector(".token-lives")
      ?.getAttribute("aria-label");

  test("a second shot that lands while I'm still on the first one's banner waits its turn, with lives advancing one shot at a time", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const renderRound = (round: ReturnType<typeof makeRound>) => (
      <RoundView
        room={{ ...makeRoom(), round }}
        me={meP1}
        myPlayer={myPlayerP1}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />
    );
    const { rerender } = render(renderRound(makeRound({ subPhase: "duel" })));
    await vi.advanceTimersByTimeAsync(0);

    // Shot 1: I hit Jugador 2. I'm left looking at its banner...
    rerender(renderRound(shotRound(1, "p1", "p2", [5, 4], 1)));
    await vi.advanceTimersByTimeAsync(2000);
    expect(document.querySelector(".rec-banner-text")?.textContent).toBe("Jugador 1 le dispara a Jugador 2.");

    // ...while Jugador 2 already dismissed theirs and shoots back.
    rerender(renderRound(shotRound(2, "p2", "p1", [4, 4], 0)));
    await vi.advanceTimersByTimeAsync(2000);
    expect(document.querySelector(".rec-banner-text")?.textContent).toBe("Jugador 1 le dispara a Jugador 2.");
    expect(livesOf("Vos")).toBe("5 de 5 vidas");
    expect(livesOf("Jugador 2")).toBe("5 de 5 vidas");

    // Dismissing shot 1 commits exactly shot 1's damage, then shot 2 plays.
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(livesOf("Vos")).toBe("5 de 5 vidas");
    expect(livesOf("Jugador 2")).toBe("4 de 5 vidas");
    expect(document.querySelector(".rec-banner-text")).not.toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(2000);
    expect(document.querySelector(".rec-banner-text")?.textContent).toBe("Jugador 2 le dispara a Jugador 1.");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(livesOf("Vos")).toBe("4 de 5 vidas");
    expect(livesOf("Jugador 2")).toBe("4 de 5 vidas");
    expect(document.querySelector(".token.active")).toHaveTextContent("Vos");
    vi.useRealTimers();
  });

  test("mounting mid-game (reload, late join) shows the current state as is, without replaying the last stored shot", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <RoundView
        room={{ ...makeRoom(), round: shotRound(5, "p2", "p1", [3, 4], 0) }}
        me={meP1}
        myPlayer={myPlayerP1}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );
    await vi.advanceTimersByTimeAsync(3000);

    expect(document.querySelector(".rec-banner-text")).not.toBeInTheDocument();
    expect(livesOf("Vos")).toBe("3 de 5 vidas");
    expect(screen.getByRole("button", { name: "Dispararme a mí" })).toBeEnabled();
    vi.useRealTimers();
  });

  test("missing an event in between (seq jumps) drops the queue and jumps straight to the latest state", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const renderRound = (round: ReturnType<typeof makeRound>) => (
      <RoundView
        room={{ ...makeRoom(), round }}
        me={meP1}
        myPlayer={myPlayerP1}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />
    );
    const { rerender } = render(renderRound(makeRound({ subPhase: "duel" })));
    await vi.advanceTimersByTimeAsync(0);

    rerender(renderRound(shotRound(1, "p1", "p2", [5, 4], 1)));
    await vi.advanceTimersByTimeAsync(2000);
    expect(document.querySelector(".rec-banner-text")).toBeInTheDocument();

    rerender(renderRound(shotRound(3, "p2", "p1", [4, 3], 0)));
    await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelector(".rec-banner-text")).not.toBeInTheDocument();
    expect(livesOf("Vos")).toBe("4 de 5 vidas");
    expect(livesOf("Jugador 2")).toBe("3 de 5 vidas");
    vi.useRealTimers();
  });
});
