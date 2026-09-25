import { useEffect, useReducer, useRef, useState } from "react";
import type { ItemKind, ShellKind } from "@juntada/recamara-engine";
import { createQueue, enqueue, finish, reset, type EventQueue, type PlayingEvent, type QueuedEvent } from "../utils/eventQueue";
import { itemFxMs } from "../utils/timing";
import { useShotAnimation, type ShotAnimation } from "./shotAnimation";

// Plays queued shots and items one at a time, in order — shared by LocalGame
// and RoundView so both modes stage every event with the same beats and
// timing. The caller renders `shown` (never the raw latest state), enqueues
// events as they happen, and calls `finish()` once the player taps through
// the event's result banner.

export type PlaybackStage = "idle" | "shot" | "shot-result" | "item-activating" | "item-result";

export interface ShotParams {
  angle: number;
  shellKind: ShellKind;
}

export interface EventDirector<S, Shot, Item> {
  shown: S;
  current: PlayingEvent<S, Shot, Item> | null;
  stage: PlaybackStage;
  busy: boolean;
  shotAnim: ShotAnimation;
  enqueue: (event: QueuedEvent<S, Shot, Item>) => void;
  finish: () => void;
  reset: (snapshot: S) => void;
}

type Action<S, Shot, Item> = { type: "enqueue"; event: QueuedEvent<S, Shot, Item> } | { type: "finish" } | { type: "reset"; snapshot: S };

function reducer<S, Shot, Item>(q: EventQueue<S, Shot, Item>, action: Action<S, Shot, Item>): EventQueue<S, Shot, Item> {
  if (action.type === "enqueue") return enqueue(q, action.event);
  if (action.type === "finish") return finish(q);
  return reset(q, action.snapshot);
}

export function useEventDirector<S, Shot, Item extends { item: ItemKind }>(
  initial: S,
  // Where the gun points and what it fires, resolved against the state shown
  // right before the shot (seat angles depend on the pre-shot order).
  shotParams: (shot: Shot, shownBefore: S) => ShotParams,
): EventDirector<S, Shot, Item> {
  const [queue, dispatch] = useReducer(reducer<S, Shot, Item>, initial, createQueue<S, Shot, Item>);
  const shotAnim = useShotAnimation();
  const [itemResultReady, setItemResultReady] = useState(false);
  const current = queue.current;

  // Read inside the playback effect, which must only re-run when a new event
  // starts (current.id) — not on every render that hands in a new callback.
  // Declared before it, so it always runs first within the same commit.
  const latest = useRef({ shown: queue.shown, shotParams });
  useEffect(() => {
    latest.current = { shown: queue.shown, shotParams };
  });

  useEffect(() => {
    if (!current) return;
    if (current.kind === "shot") {
      const { angle, shellKind } = latest.current.shotParams(current.payload, latest.current.shown);
      return shotAnim.playShot(angle, shellKind);
    }
    setItemResultReady(false);
    const t = setTimeout(() => setItemResultReady(true), itemFxMs(current.payload.item));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  let stage: PlaybackStage = "idle";
  if (current?.kind === "shot") stage = shotAnim.fireStage === "result" ? "shot-result" : "shot";
  if (current?.kind === "item") stage = itemResultReady ? "item-result" : "item-activating";

  return {
    shown: queue.shown,
    current,
    stage,
    busy: current !== null,
    shotAnim,
    enqueue: event => dispatch({ type: "enqueue", event }),
    finish: () => {
      shotAnim.finishShot();
      setItemResultReady(false);
      dispatch({ type: "finish" });
    },
    reset: snapshot => {
      shotAnim.finishShot();
      setItemResultReady(false);
      dispatch({ type: "reset", snapshot });
    },
  };
}
