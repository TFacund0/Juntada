import { describe, expect, it } from "vitest";
import type { LastItemEvent, PendingFire, RecamaraRoundView } from "@juntada/recamara-engine";
import { classifyRoundUpdate, seqsOf } from "../utils/roundUpdates";

function fire(seq: number): PendingFire {
  return {
    seq,
    shooterId: "p1",
    targetId: "p2",
    shellKind: "live",
    damage: 1,
    gameOver: false,
    winnerId: null,
    reloaded: false,
    skippedIds: [],
  };
}

function itemEvent(seq: number): LastItemEvent {
  return { seq, playerId: "p1", item: "🚬" };
}

// Only the two seq-carrying fields matter to the classifier.
function round(fireSeq: number, itemSeq: number): RecamaraRoundView {
  return {
    pendingFire: fireSeq ? fire(fireSeq) : null,
    lastItemEvent: itemSeq ? itemEvent(itemSeq) : null,
  } as RecamaraRoundView;
}

describe("classifyRoundUpdate", () => {
  it("reads a missing pendingFire/lastItemEvent as seq 0", () => {
    expect(seqsOf(round(0, 0))).toEqual({ fire: 0, item: 0 });
  });

  it("no seq moved: a plain sync", () => {
    expect(classifyRoundUpdate({ fire: 3, item: 2 }, round(3, 2))).toBe("sync");
  });

  it("the fire seq moved by one: a new shot", () => {
    expect(classifyRoundUpdate({ fire: 3, item: 2 }, round(4, 2))).toBe("shot");
  });

  it("the item seq moved by one: a new item", () => {
    expect(classifyRoundUpdate({ fire: 3, item: 2 }, round(3, 3))).toBe("item");
  });

  it("a seq jumped past one event: resync, those in-between states are lost", () => {
    expect(classifyRoundUpdate({ fire: 3, item: 2 }, round(5, 2))).toBe("resync");
    expect(classifyRoundUpdate({ fire: 3, item: 2 }, round(3, 4))).toBe("resync");
  });

  it("both seqs moved in one message: resync", () => {
    expect(classifyRoundUpdate({ fire: 3, item: 2 }, round(4, 3))).toBe("resync");
  });

  it("a seq went backwards (new game): resync", () => {
    expect(classifyRoundUpdate({ fire: 3, item: 2 }, round(0, 0))).toBe("resync");
  });

  it("no baseline yet: resync", () => {
    expect(classifyRoundUpdate(null, round(1, 0))).toBe("resync");
  });
});
