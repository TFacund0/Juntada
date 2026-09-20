import { useEffect, useRef, useState } from "react";

interface UsePendingActionRetryArgs<T> {
  // True right after the socket reconnects — the one moment worth replaying
  // a dropped send() for, since that's when it's likely to actually go
  // through this time.
  justReconnected: boolean;
  // True once whatever this action was waiting for already happened by some
  // other path (e.g. the phase moved on) — clears the pending state without
  // waiting for the timeout.
  settled: boolean;
  // Re-sends the exact payload passed to perform().
  send: (payload: T) => void;
  // Covers the case where neither settled nor a reconnect-retry ever
  // resolves it — without this, callers would stay stuck "in flight" forever.
  onTimeout: () => void;
  timeoutMs?: number;
}

interface UsePendingActionRetryResult<T> {
  pending: T | null;
  perform: (payload: T) => void;
}

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Generic version of the retry-on-reconnect pattern first written for
 * join_instance (see usePendingJoinRetry): send() silently drops a message
 * if the socket isn't OPEN at the exact moment of the call (flaky
 * connection, mid-reconnect) — this tracks that one pending payload and
 * replays it once justReconnected fires, instead of leaving the caller to
 * notice and retry manually.
 *
 * Deliberately single-payload, not a queue: only one action of this kind is
 * ever meant to be in flight at a time per caller (a second perform() call
 * simply replaces the first). A caller that needs to track multiple
 * concurrent in-flight actions needs a different shape — don't stretch this
 * one to cover that until it's an actual case.
 */
export function usePendingActionRetry<T>({
  justReconnected,
  settled,
  send,
  onTimeout,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: UsePendingActionRetryArgs<T>): UsePendingActionRetryResult<T> {
  const [pending, setPending] = useState<T | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const perform = (payload: T) => {
    setPending(payload);
    send(payload);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setPending(null);
      onTimeout();
    }, timeoutMs);
  };

  useEffect(() => {
    if (settled) setPending(null);
  }, [settled]);

  useEffect(() => {
    if (justReconnected && pending !== null && !settled) send(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justReconnected]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  return { pending, perform };
}
