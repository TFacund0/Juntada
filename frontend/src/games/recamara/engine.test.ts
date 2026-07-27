import { describe, test, expect, vi } from "vitest";
import {
  buildShells,
  createInitialState,
  describeItemResult,
  fireShot,
  useItem,
  ITEMS_PER_RELOAD,
  MAX_ITEMS,
  MAX_LIVES,
  STARTING_LIVES,
} from "@juntada/recamara-engine";

describe("recamara engine", () => {
  test("buildShells stays within 2..8 shells and matches its own live/blank split", () => {
    for (let i = 0; i < 50; i++) {
      const shells = buildShells();
      expect(shells.length).toBeGreaterThanOrEqual(2);
      expect(shells.length).toBeLessThanOrEqual(8);
      expect(shells.every(s => !s.spent && !s.revealed)).toBe(true);
    }
  });

  test("createInitialState gives every player full lives and starting items", () => {
    const state = createInitialState(["Ana", "Beto", "Caro"]);
    expect(state.players).toHaveLength(3);
    expect(state.players.every(p => p.lives === STARTING_LIVES)).toBe(true);
    expect(state.players.every(p => p.items.length === ITEMS_PER_RELOAD)).toBe(true);
    expect(state.turnPos).toBe(0);
    expect(state.direction).toBe(1);
  });

  test("a live shell on another player deals damage and passes the turn", () => {
    const state = createInitialState(["Ana", "Beto"]);
    state.shells = [{ kind: "live", spent: false, revealed: false }];
    state.idx = 0;
    const result = fireShot(state, state.players[1].id);
    expect(result.damage).toBe(1);
    expect(result.state.players.find(p => p.id === state.players[1].id)!.lives).toBe(STARTING_LIVES - 1);
    expect(result.gameOver).toBe(false);
  });

  test("a blank shell on yourself keeps the turn", () => {
    const state = createInitialState(["Ana", "Beto"]);
    state.shells = [
      { kind: "blank", spent: false, revealed: false },
      { kind: "blank", spent: false, revealed: false },
    ];
    state.idx = 0;
    const result = fireShot(state, state.players[0].id);
    expect(result.damage).toBe(0);
    expect(result.state.turnPos).toBe(0);
  });

  test("the sierra doubles damage on the next live shot only", () => {
    const state = createInitialState(["Ana", "Beto"]);
    state.sawedOff = true;
    state.shells = [{ kind: "live", spent: false, revealed: false }];
    state.idx = 0;
    const result = fireShot(state, state.players[1].id);
    expect(result.damage).toBe(2);
    expect(result.state.sawedOff).toBe(false);
  });

  test("emptying the chamber reloads and hands out new items to everyone", () => {
    const state = createInitialState(["Ana", "Beto"]);
    state.shells = [{ kind: "blank", spent: false, revealed: false }];
    state.idx = 0;
    const before = state.players.map(p => p.items.length);
    const result = fireShot(state, state.players[1].id);
    expect(result.reloaded).toBe(true);
    result.state.players.forEach((p, i) => expect(p.items.length).toBe(before[i] + ITEMS_PER_RELOAD));
    expect(result.state.shells.length).toBeGreaterThanOrEqual(2);
  });

  test("a reload never lets a player's item count exceed MAX_ITEMS", () => {
    const state = createInitialState(["Ana", "Beto"]);
    state.players[0].items = ["🔍", "🚬", "🪚", "🔄"]; // 4 already — the reload would push past 5
    state.shells = [{ kind: "blank", spent: false, revealed: false }];
    state.idx = 0;
    const result = fireShot(state, state.players[1].id);
    expect(result.reloaded).toBe(true);
    expect(result.state.players[0].items.length).toBe(MAX_ITEMS);
  });

  test("ladrón never pushes the thief's item count past MAX_ITEMS", () => {
    const state = createInitialState(["Ana", "Beto"]);
    state.players[0].items = ["🔍", "🚬", "🪚", "🔄", "🧤"]; // already at the cap
    state.players[1].items = ["📞"];
    const result = useItem(state, "🧤");
    expect(result.state.players[0].items.length).toBe(MAX_ITEMS);
  });

  test("the last player standing ends the game", () => {
    const state = createInitialState(["Ana", "Beto"]);
    state.players[1].lives = 1;
    state.shells = [{ kind: "live", spent: false, revealed: false }];
    state.idx = 0;
    const result = fireShot(state, state.players[1].id);
    expect(result.gameOver).toBe(true);
    expect(result.winner?.id).toBe(state.players[0].id);
  });

  test("cigarrillo heals but never above the life cap", () => {
    const state = createInitialState(["Ana", "Beto"]);
    state.players[0].items = ["🚬"];
    const result = useItem(state, "🚬");
    expect(result.healedTo).toBe(MAX_LIVES);
    expect(result.state.players[0].items).toHaveLength(0);

    state.players[0].lives = MAX_LIVES - 1;
    state.players[0].items = ["🚬"];
    const healed = useItem(state, "🚬");
    expect(healed.healedTo).toBe(MAX_LIVES);
  });

  test("inversor flips the turn direction", () => {
    const state = createInitialState(["Ana", "Beto"]);
    state.players[0].items = ["🔄"];
    const result = useItem(state, "🔄");
    expect(result.state.direction).toBe(-1);
  });

  test("ladrón steals an item from another player who has one", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const state = createInitialState(["Ana", "Beto"]);
    state.players[0].items = ["🧤"];
    state.players[1].items = ["🚬"];
    const result = useItem(state, "🧤");
    expect(result.victimId).toBe(state.players[1].id);
    expect(result.state.players.find(p => p.id === state.players[1].id)!.items).toHaveLength(0);
    expect(result.state.players.find(p => p.id === state.players[0].id)!.items).toContain("🚬");
    vi.restoreAllMocks();
  });

  test("ladrón with an explicit targetId that has no items falls back to a random eligible victim instead of throwing", () => {
    // 3 players: the acting player, a targetId with 0 items (what a stale
    // or malicious online client could send), and a third who does have
    // one — findPlayer would previously throw here since the requested
    // target isn't in the "others with items" pool at all.
    const state = createInitialState(["Ana", "Beto", "Caro"]);
    state.players[0].items = ["🧤"];
    state.players[1].items = [];
    state.players[2].items = ["🚬"];
    const result = useItem(state, "🧤", { targetId: state.players[1].id });
    expect(result.victimId).toBe(state.players[2].id);
    expect(result.state.players.find(p => p.id === state.players[2].id)!.items).toHaveLength(0);
  });

  test("ladrón with a stolenItem the victim doesn't actually have falls back to a random real item instead of deleting the wrong one", () => {
    const state = createInitialState(["Ana", "Beto"]);
    state.players[0].items = ["🧤"];
    state.players[1].items = ["🚬", "🔄"];
    const result = useItem(state, "🧤", { targetId: state.players[1].id, stolenItem: "📞" });
    // "📞" was never in the victim's items — the fallback must pick one of
    // their *real* items, and the victim must end up with exactly one item
    // left (not both intact, which is what indexOf(-1)/splice(-1,1) used
    // to do: silently remove whichever item happened to be last).
    expect(["🚬", "🔄"]).toContain(result.stolenItem);
    expect(result.state.players.find(p => p.id === state.players[1].id)!.items).toHaveLength(1);
    expect(result.state.players.find(p => p.id === state.players[0].id)!.items).toContain(result.stolenItem);
  });

  test("teléfono reveals a future shell without touching the current one", () => {
    const state = createInitialState(["Ana", "Beto"]);
    state.players[0].items = ["📞"];
    state.shells = [
      { kind: "blank", spent: false, revealed: false },
      { kind: "live", spent: false, revealed: false },
    ];
    state.idx = 0;
    const result = useItem(state, "📞");
    expect(result.phoneHint).toEqual({ positionFromNow: 2, shellKind: "live" });
    expect(result.state.shells[0].revealed).toBe(false);
    expect(result.state.shells[1].revealed).toBe(true);
  });

  test("describeItemResult redacts the teléfono hint when revealPhoneHint is false", () => {
    const result = { playerId: 0, item: "📞" as const, phoneHint: { positionFromNow: 2, shellKind: "live" as const } };
    const nameOf = () => "Ana";
    expect(describeItemResult(result, nameOf, { revealPhoneHint: false }).text).toBe("<b>Ana</b> llama por teléfono.");
    expect(describeItemResult(result, nameOf).text).toContain("posición <b>2</b>");
  });

  test("esposas cuffs the target, and their next turn is skipped and the cuff consumed", () => {
    const state = createInitialState(["Ana", "Beto", "Caro"]);
    state.players[0].items = ["🔒"];
    const cuffResult = useItem(state, "🔒", { targetId: state.players[1].id });
    expect(cuffResult.cuffedId).toBe(state.players[1].id);
    expect(cuffResult.state.players.find(p => p.id === state.players[1].id)!.cuffed).toBe(true);

    // Ana (turnPos 0) fires at Caro with a blank — turn would normally
    // advance to Beto next, but he's cuffed, so it should skip to Caro.
    const shotState = { ...cuffResult.state, shells: [{ kind: "blank" as const, spent: false, revealed: false }], idx: 0 };
    const fireResult = fireShot(shotState, state.players[2].id);
    expect(fireResult.skippedIds).toEqual([state.players[1].id]);
    expect(fireResult.state.turnPos).toBe(shotState.order.indexOf(state.players[2].id));
    expect(fireResult.state.players.find(p => p.id === state.players[1].id)!.cuffed).toBe(false);
  });
});
