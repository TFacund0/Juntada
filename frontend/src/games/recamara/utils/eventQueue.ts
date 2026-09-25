// Pure playback queue behind useEventDirector — no React, no timers.
//
// Every event carries the state the table should show once that event has
// finished playing (`after`). `shown` only ever moves forward to the `after`
// of an event whose animation is done, so a second shot that arrives while
// the first one is still on screen waits its turn, and starts from the state
// right after the first one — never from a stale snapshot, never from the
// final state that would spoil it.
//
// "sync" is a state update with nothing to animate (someone got ready, a
// player reconnected). It still goes through the queue so it can't jump
// ahead of a shot that's still playing; it's applied the moment it reaches
// the front.

export type QueuedEvent<S, Shot, Item> =
  { kind: "shot"; payload: Shot; after: S } | { kind: "item"; payload: Item; after: S } | { kind: "sync"; after: S };

export type PlayingEvent<S, Shot, Item> = Exclude<QueuedEvent<S, Shot, Item>, { kind: "sync" }> & { id: number };

export interface EventQueue<S, Shot, Item> {
  shown: S;
  current: PlayingEvent<S, Shot, Item> | null;
  pending: QueuedEvent<S, Shot, Item>[];
  // Gives each started event a distinct id, so the playback effect can tell
  // two back-to-back shots apart even if they happen to look identical.
  nextId: number;
}

export function createQueue<S, Shot, Item>(initial: S): EventQueue<S, Shot, Item> {
  return { shown: initial, current: null, pending: [], nextId: 1 };
}

function advance<S, Shot, Item>(q: EventQueue<S, Shot, Item>): EventQueue<S, Shot, Item> {
  let { shown, nextId } = q;
  const pending = [...q.pending];
  let current = q.current;
  while (!current && pending.length > 0) {
    const next = pending.shift()!;
    if (next.kind === "sync") {
      shown = next.after;
    } else {
      current = { ...next, id: nextId };
      nextId += 1;
    }
  }
  return { shown, current, pending, nextId };
}

export function enqueue<S, Shot, Item>(q: EventQueue<S, Shot, Item>, event: QueuedEvent<S, Shot, Item>): EventQueue<S, Shot, Item> {
  return advance({ ...q, pending: [...q.pending, event] });
}

// The current event's animation is over (its banner got dismissed): commit
// its state and start whatever is next.
export function finish<S, Shot, Item>(q: EventQueue<S, Shot, Item>): EventQueue<S, Shot, Item> {
  if (!q.current) return q;
  return advance({ ...q, shown: q.current.after, current: null });
}

// Drops everything queued or playing and jumps straight to `snapshot` — for
// when the intermediate states can't be reconstructed (reconnect, missed
// events) or a brand-new game starts.
export function reset<S, Shot, Item>(q: EventQueue<S, Shot, Item>, snapshot: S): EventQueue<S, Shot, Item> {
  return { shown: snapshot, current: null, pending: [], nextId: q.nextId };
}
