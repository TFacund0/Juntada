import { describe, expect, it } from "vitest";
import { createQueue, enqueue, finish, reset } from "../utils/eventQueue";

// State is just a label here: what matters is *when* `shown` moves.
const shot = (after: string) => ({ kind: "shot" as const, payload: `shot→${after}`, after });
const item = (after: string) => ({ kind: "item" as const, payload: `item→${after}`, after });
const sync = (after: string) => ({ kind: "sync" as const, after });

describe("eventQueue", () => {
  it("starts an event right away when idle, but keeps showing the previous state until it finishes", () => {
    let q = createQueue<string, string, string>("s0");
    q = enqueue(q, shot("s1"));
    expect(q.current?.payload).toBe("shot→s1");
    expect(q.shown).toBe("s0");

    q = finish(q);
    expect(q.current).toBeNull();
    expect(q.shown).toBe("s1");
  });

  it("a second shot arriving mid-animation waits its turn and starts from the first shot's state", () => {
    let q = createQueue<string, string, string>("s0");
    q = enqueue(q, shot("s1"));
    q = enqueue(q, shot("s2"));
    expect(q.current?.payload).toBe("shot→s1");
    expect(q.shown).toBe("s0");

    q = finish(q);
    expect(q.current?.payload).toBe("shot→s2");
    expect(q.shown).toBe("s1");

    q = finish(q);
    expect(q.current).toBeNull();
    expect(q.shown).toBe("s2");
  });

  it("plays shots and items in arrival order, each with its own id", () => {
    let q = createQueue<string, string, string>("s0");
    q = enqueue(q, item("s1"));
    q = enqueue(q, shot("s2"));
    const firstId = q.current?.id;
    expect(q.current?.kind).toBe("item");

    q = finish(q);
    expect(q.current?.kind).toBe("shot");
    expect(q.current?.id).not.toBe(firstId);
  });

  it("a sync update applies immediately when idle", () => {
    const q = enqueue(createQueue<string, string, string>("s0"), sync("s1"));
    expect(q.current).toBeNull();
    expect(q.shown).toBe("s1");
  });

  it("a sync update never jumps ahead of an event that's still playing", () => {
    let q = createQueue<string, string, string>("s0");
    q = enqueue(q, shot("s1"));
    q = enqueue(q, sync("s1b"));
    expect(q.shown).toBe("s0");

    q = finish(q);
    expect(q.current).toBeNull();
    expect(q.shown).toBe("s1b");
  });

  it("syncs queued between two events are applied on the way to the next one", () => {
    let q = createQueue<string, string, string>("s0");
    q = enqueue(q, shot("s1"));
    q = enqueue(q, sync("s1b"));
    q = enqueue(q, shot("s2"));

    q = finish(q);
    expect(q.current?.payload).toBe("shot→s2");
    expect(q.shown).toBe("s1b");
  });

  it("finish with nothing playing is a no-op", () => {
    const q = createQueue<string, string, string>("s0");
    expect(finish(q)).toBe(q);
  });

  it("reset drops whatever is playing or queued and jumps to the snapshot", () => {
    let q = createQueue<string, string, string>("s0");
    q = enqueue(q, shot("s1"));
    q = enqueue(q, shot("s2"));

    q = reset(q, "s9");
    expect(q.current).toBeNull();
    expect(q.pending).toEqual([]);
    expect(q.shown).toBe("s9");
  });
});
