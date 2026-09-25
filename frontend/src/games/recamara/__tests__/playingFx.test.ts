import { describe, expect, it } from "vitest";
import type { FireResult, ItemResult, LastItemEvent, PendingFire, Player } from "@juntada/recamara-engine";
import { localPlayingFx, onlinePlayingFx } from "../utils/playingFx";
import { ejectShellSpot } from "../utils/arena";

const players: Player[] = [
  { id: 0, name: "Ana", lives: 3, items: [], lastGrantedItems: [] },
  { id: 1, name: "Beto", lives: 5, items: [], lastGrantedItems: [] },
];

const online = (myRole: Record<string, unknown> | null = null) => ({
  seatOrder: ["pA", "pB"],
  players,
  myPlayerId: "pA",
  myRole,
  nameFor: (id: string) => (id === "pA" ? "Ana" : "Beto"),
});

const fire = (targetId: string, damage = 1, shellKind: PendingFire["shellKind"] = "live"): PendingFire => ({
  seq: 1,
  shooterId: "pB",
  targetId,
  shellKind,
  damage,
  gameOver: false,
  winnerId: null,
  reloaded: false,
  skippedIds: [],
});

describe("onlinePlayingFx", () => {
  it("nothing playing → null", () => {
    expect(onlinePlayingFx(null, online())).toBeNull();
  });

  it("a shot maps its target to the engine seat and flags when it's aimed at me", () => {
    const at = (targetId: string) => onlinePlayingFx({ id: 7, kind: "shot", payload: fire(targetId), after: null }, online());
    expect(at("pA")).toMatchObject({ id: 7, kind: "shot", shellKind: "live", targetId: 0, damage: 1, targetIsMe: true });
    expect(at("pB")).toMatchObject({ targetId: 1, targetIsMe: false });
  });

  it("flags the shot that takes the target's last life", () => {
    const shot = (payload: PendingFire) => onlinePlayingFx({ id: 1, kind: "shot", payload, after: null }, online());
    expect(shot(fire("pA", 1))?.eliminates).toBe(false); // Ana 3 -> 2
    expect(shot(fire("pA", 3))?.eliminates).toBe(true); // Ana 3 -> 0
    expect(shot(fire("pA", 3, "blank"))?.eliminates).toBe(false);
  });

  it("🔍 reveals the shell only to its user, and only for the matching private hint", () => {
    const lupa = (playerId: string, hintSeq: number) =>
      onlinePlayingFx(
        { id: 1, kind: "item", payload: { seq: 4, playerId, item: "🔍" } as LastItemEvent, after: null },
        online({ lupaHint: { seq: hintSeq, shellKind: "blank" } }),
      );
    expect(lupa("pA", 4)).toMatchObject({ actorId: 0, actorIsMe: true, revealedShellKind: "blank" });
    expect(lupa("pA", 3)?.revealedShellKind).toBeNull();
    expect(lupa("pB", 4)).toMatchObject({ actorIsMe: false, actorName: "Beto", revealedShellKind: null });
  });

  it("🚬 counts as healed only when lives actually went up", () => {
    const cig = (playerId: string, healedTo: number) =>
      onlinePlayingFx({ id: 1, kind: "item", payload: { seq: 1, playerId, item: "🚬", healedTo } as LastItemEvent, after: null }, online());
    expect(cig("pA", 4)?.healed).toBe(true); // Ana had 3
    expect(cig("pB", 5)?.healed).toBe(false); // Beto was already at 5
  });
});

describe("localPlayingFx", () => {
  it("a shot carries its engine target and shell kind", () => {
    const result = { targetId: 1, shellKind: "blank", damage: 0 } as FireResult;
    expect(localPlayingFx({ id: 2, kind: "shot", payload: { result, playersBefore: players }, after: null }, players)).toMatchObject({
      kind: "shot",
      targetId: 1,
      shellKind: "blank",
      damage: 0,
    });
  });

  it("a live shell that empties the target's lives eliminates them", () => {
    const shot = (damage: number) =>
      localPlayingFx(
        {
          id: 2,
          kind: "shot",
          payload: { result: { targetId: 0, shellKind: "live", damage } as FireResult, playersBefore: players },
          after: null,
        },
        players,
      );
    expect(shot(2)?.eliminates).toBe(false);
    expect(shot(4)?.eliminates).toBe(true);
  });

  it("items are always seen by the device's holder (pass-and-play)", () => {
    const used = { playerId: 0, item: "🔍", revealedShellKind: "live" } as ItemResult;
    expect(localPlayingFx({ id: 3, kind: "item", payload: used, after: null }, players)).toMatchObject({
      actorId: 0,
      actorIsMe: true,
      actorName: "Ana",
      revealedShellKind: "live",
    });
  });
});

describe("ejectShellSpot", () => {
  it("throws the casing out sideways from the gun, 16%–26% from the table's center", () => {
    for (const r of [0, 0.5, 0.999]) {
      const spot = ejectShellSpot(0, () => r);
      const dist = Math.hypot(spot.left - 50, spot.top - 50);
      expect(dist).toBeGreaterThanOrEqual(16 - 1e-9);
      expect(dist).toBeLessThanOrEqual(26);
    }
    // Gun pointing right (0°), no jitter: lands straight "below" it (90°).
    const straight = ejectShellSpot(0, () => 0.5);
    expect(straight.left).toBeCloseTo(50);
    expect(straight.top).toBeGreaterThan(50);
  });
});
