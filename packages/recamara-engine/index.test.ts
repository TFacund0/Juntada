import { describe, expect, it } from "vitest";
import {
  buildShells,
  canUseItem,
  createInitialState,
  describeFireOutcome,
  describeItemResult,
  describeSkippedTurn,
  fireShot,
  useItem,
  type GameState,
} from "./index";

describe("buildShells", () => {
  it("always includes at least one live and one blank shell", () => {
    for (let i = 0; i < 50; i++) {
      const shells = buildShells();
      expect(shells.some(s => s.kind === "live")).toBe(true);
      expect(shells.some(s => s.kind === "blank")).toBe(true);
      expect(shells.length).toBeGreaterThanOrEqual(3);
      expect(shells.length).toBeLessThanOrEqual(8);
    }
  });
});

describe("fireShot", () => {
  it("deals no damage on a blank shell and keeps the turn on self-fire", () => {
    const state = createInitialState(["A", "B"]);
    state.shells = [{ kind: "blank", spent: false, revealed: false }];
    const result = fireShot(state, state.players[0].id);
    expect(result.damage).toBe(0);
    expect(result.shellKind).toBe("blank");
  });

  it("deals damage on a live shell and ends the game once one player remains", () => {
    const state = createInitialState(["A", "B"]);
    state.players[1].lives = 1;
    state.shells = [{ kind: "live", spent: false, revealed: false }];
    const result = fireShot(state, state.players[1].id);
    expect(result.damage).toBe(1);
    expect(result.gameOver).toBe(true);
    expect(result.winner?.id).toBe(state.players[0].id);
  });

  it("doubles damage when sawedOff is set", () => {
    const state = createInitialState(["A", "B"]);
    state.sawedOff = true;
    state.shells = [
      { kind: "live", spent: false, revealed: false },
      { kind: "blank", spent: false, revealed: false },
    ];
    const result = fireShot(state, state.players[1].id);
    expect(result.damage).toBe(2);
    expect(result.state.sawedOff).toBe(false);
  });

  it("skips a cuffed player's turn and clears the cuff", () => {
    const state: GameState = {
      ...createInitialState(["A", "B", "C"]),
      shells: [
        { kind: "blank", spent: false, revealed: false },
        { kind: "blank", spent: false, revealed: false },
      ],
    };
    state.players[1].cuffed = true;
    const result = fireShot(state, state.players[2].id);
    expect(result.skippedIds).toContain(1);
    expect(result.state.players.find(p => p.id === 1)?.cuffed).toBe(false);
  });
});

describe("useItem", () => {
  const baseState = (): GameState => ({
    ...createInitialState(["A", "B"]),
    shells: [{ kind: "live", spent: false, revealed: false }],
  });

  it("🔍 reveals the current shell and consumes the item", () => {
    const state = baseState();
    state.players[0].items = ["🔍"];
    const result = useItem(state, "🔍");
    expect(result.revealedShellKind).toBe("live");
    expect(result.state.players[0].items).not.toContain("🔍");
  });

  it("🚬 heals up to MAX_LIVES, never past it", () => {
    const state = baseState();
    state.players[0].items = ["🚬"];
    state.players[0].lives = 5;
    const result = useItem(state, "🚬");
    expect(result.healedTo).toBe(5);
  });

  it("🧤 falls back to a random valid pick when the requested target/item is invalid", () => {
    const state = baseState();
    state.players[0].items = ["🧤"];
    state.players[1].items = ["🚬"];
    const result = useItem(state, "🧤", { targetId: 999, stolenItem: "🔒" });
    expect(result.victimId).toBe(1);
    expect(result.stolenItem).toBe("🚬");
  });

  it("🧤 never steals another 🧤: a victim holding only 🧤 has nothing to take", () => {
    const state = baseState();
    state.players[0].items = ["🧤"];
    state.players[1].items = ["🧤", "🚬"];
    for (let i = 0; i < 20; i++) expect(useItem(state, "🧤").stolenItem).toBe("🚬");
    // Asking for their 🧤 falls back to something that can be taken.
    expect(useItem(state, "🧤", { targetId: 1, stolenItem: "🧤" }).stolenItem).toBe("🚬");

    state.players[1].items = ["🧤"];
    const result = useItem(state, "🧤");
    expect(result.victimId).toBeNull();
    expect(result.state.players[1].items).toEqual(["🧤"]);
  });

  it("🧤 works once per turn: a second one waits for the next turn", () => {
    const state = baseState();
    state.players[0].items = ["🧤", "🧤"];
    state.players[1].items = ["🚬", "🔍"];
    expect(canUseItem(state, "🧤")).toBe(true);
    const first = useItem(state, "🧤");
    expect(first.state.stealUsedThisTurn).toBe(true);
    expect(canUseItem(first.state, "🧤")).toBe(false);
    expect(() => useItem(first.state, "🧤")).toThrow();
    // Other items are still fine this turn.
    first.state.players[0].items.push("🚬");
    expect(canUseItem(first.state, "🚬")).toBe(true);
  });

  it("the steal is back once the turn passes, but not after a blank self-shot (same turn)", () => {
    const state = baseState();
    state.players[0].items = ["🧤", "🧤"];
    state.players[1].items = ["🚬", "🔍"];
    const used = useItem(state, "🧤").state;

    const blankSelf = { ...used, shells: used.shells.map((s, i) => (i === used.idx ? { ...s, kind: "blank" as const } : s)) };
    const kept = fireShot(blankSelf, 0).state;
    expect(kept.turnPos).toBe(used.turnPos);
    expect(canUseItem(kept, "🧤")).toBe(false);

    const passed = fireShot(blankSelf, 1).state;
    expect(passed.stealUsedThisTurn).toBe(false);
  });

  it("canUseItem: only what the current player actually holds", () => {
    const state = baseState();
    state.players[0].items = ["🔍"];
    expect(canUseItem(state, "🔍")).toBe(true);
    expect(canUseItem(state, "🚬")).toBe(false);
  });

  it("🔒 falls back to a random valid target when the requested one is invalid", () => {
    const state = baseState();
    state.players[0].items = ["🔒"];
    const result = useItem(state, "🔒", { targetId: 999 });
    expect(result.cuffedId).toBe(1);
    expect(result.state.players.find(p => p.id === 1)?.cuffed).toBe(true);
  });
});

describe("log line HTML escaping", () => {
  const nameOf = (id: number) => (id === 0 ? '<img src=x onerror="alert(1)">' : "Bob");

  it("escapes a malicious player name in describeFireOutcome", () => {
    const outcome = describeFireOutcome({ shooterId: 0, targetId: 1, shellKind: "blank", damage: 0 }, nameOf);
    expect(outcome.actionLine).not.toContain("<img");
    expect(outcome.actionLine).toContain("&lt;img");
  });

  it("escapes a malicious player name in describeSkippedTurn", () => {
    const line = describeSkippedTurn(0, nameOf);
    expect(line.text).not.toContain("<img");
  });

  it("escapes a malicious player name in describeItemResult for every item variant", () => {
    const stolen = describeItemResult({ playerId: 0, item: "🧤", victimId: 0 }, nameOf);
    expect(stolen.text).not.toContain("<img");
    const cuffed = describeItemResult({ playerId: 1, item: "🔒", cuffedId: 0 }, nameOf);
    expect(cuffed.text).not.toContain("<img");
  });
});
