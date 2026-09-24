import type { RecamaraRoundView } from "@juntada/recamara-engine";

// The server keeps only the latest pendingFire/lastItemEvent and bumps a
// per-game seq on each (see backend/src/games/recamara/engine.ts). Each
// action is its own broadcast, so between two consecutive messages exactly
// one of those seqs can move, and by exactly 1. Anything else means this
// client missed messages (dropped socket, page reload, joining mid-game) and
// can't rebuild the in-between states — so it resyncs instead of replaying.

export interface RoundSeqs {
  fire: number;
  item: number;
}

export type RoundUpdate = "shot" | "item" | "sync" | "resync";

export function seqsOf(round: RecamaraRoundView): RoundSeqs {
  return { fire: round.pendingFire?.seq ?? 0, item: round.lastItemEvent?.seq ?? 0 };
}

export function classifyRoundUpdate(prev: RoundSeqs | null, next: RecamaraRoundView): RoundUpdate {
  if (!prev) return "resync";
  const seqs = seqsOf(next);
  const fireDelta = seqs.fire - prev.fire;
  const itemDelta = seqs.item - prev.item;
  if (fireDelta === 0 && itemDelta === 0) return "sync";
  if (fireDelta === 1 && itemDelta === 0 && next.pendingFire) return "shot";
  if (itemDelta === 1 && fireDelta === 0 && next.lastItemEvent) return "item";
  return "resync";
}
