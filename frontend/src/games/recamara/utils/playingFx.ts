import type { FireResult, ItemKind, ItemResult, LastItemEvent, PendingFire, Player, ShellKind } from "@juntada/recamara-engine";
import type { PlayingEvent } from "./eventQueue";

// Everything the presentation layer needs to know about the event the
// director is playing right now — sound (useEventSfx), the table's shot
// effects (DuelTable) and the item's own animation (ItemEffect) — built
// once per mode from that mode's own payload shape, so none of those have
// to know whether they're running online or local.
export interface PlayingFx {
  // Distinct per started event (PlayingEvent.id) — effects fire once per id.
  id: number;
  kind: "shot" | "item";
  shellKind?: ShellKind;
  // Engine id of the shot's target, and how many lives a live shell takes.
  targetId?: number;
  damage?: number;
  // A live shell that takes the target's last life.
  eliminates?: boolean;
  // Engine id of whoever used the item.
  actorId?: number;
  // Online only: aimed at / used by this device's player. Local play has no
  // "me", so these stay false there.
  targetIsMe?: boolean;
  actorIsMe?: boolean;
  item?: ItemKind;
  actorName?: string;
  // 🔍: the shell only the item's user gets to see — null for everyone else.
  revealedShellKind?: ShellKind | null;
  // 🚬: whether it actually gave a life back (it can't past the cap).
  healed?: boolean;
}

// healedTo is the user's lives *after* the 🚬, capped — only comparing it
// with the lives still on screen (the pre-item state) tells a real heal
// from a wasted one.
function didHeal(healedTo: number | undefined, livesBefore: number | undefined): boolean {
  return healedTo != null && livesBefore != null && healedTo > livesBefore;
}

// Against the lives still on screen (the pre-shot state).
function eliminates(shellKind: ShellKind, damage: number, livesBefore: number | undefined): boolean {
  return shellKind === "live" && livesBefore != null && livesBefore > 0 && livesBefore - damage <= 0;
}

interface OnlineContext {
  seatOrder: string[];
  // The state still on screen, i.e. right before this event.
  players: Player[];
  myPlayerId: string | null;
  // This client's private_role message (see the lupaHint it may carry).
  myRole: Record<string, unknown> | null | undefined;
  nameFor: (roomId: string) => string;
}

export function onlinePlayingFx(event: PlayingEvent<unknown, PendingFire, LastItemEvent> | null, ctx: OnlineContext): PlayingFx | null {
  if (!event) return null;
  if (event.kind === "shot") {
    const shot = event.payload;
    const targetId = ctx.seatOrder.indexOf(shot.targetId);
    return {
      id: event.id,
      kind: "shot",
      shellKind: shot.shellKind,
      targetId,
      damage: shot.damage,
      eliminates: eliminates(shot.shellKind, shot.damage, ctx.players.find(p => p.id === targetId)?.lives),
      targetIsMe: shot.targetId === ctx.myPlayerId,
    };
  }
  const used = event.payload;
  const actorIsMe = used.playerId === ctx.myPlayerId;
  // The real 🔍 result never travels in the public event — only in this
  // client's own private_role, and only for the call whose seq it matches.
  const lupa = ctx.myRole?.lupaHint as { seq: number; shellKind: ShellKind } | undefined;
  return {
    id: event.id,
    kind: "item",
    item: used.item,
    actorId: ctx.seatOrder.indexOf(used.playerId),
    actorIsMe,
    actorName: ctx.nameFor(used.playerId),
    revealedShellKind: actorIsMe && lupa?.seq === used.seq ? lupa.shellKind : null,
    healed: didHeal(used.healedTo, ctx.players.find(p => p.id === ctx.seatOrder.indexOf(used.playerId))?.lives),
  };
}

export function localPlayingFx(
  event: PlayingEvent<unknown, { result: FireResult; playersBefore: Player[] }, ItemResult> | null,
  players: Player[],
): PlayingFx | null {
  if (!event) return null;
  if (event.kind === "shot") {
    const { result } = event.payload;
    return {
      id: event.id,
      kind: "shot",
      shellKind: result.shellKind,
      targetId: result.targetId,
      damage: result.damage,
      eliminates: eliminates(result.shellKind, result.damage, players.find(p => p.id === result.targetId)?.lives),
    };
  }
  const used = event.payload;
  // Pass-and-play: the device is in the user's hands, so they see it.
  return {
    id: event.id,
    kind: "item",
    item: used.item,
    actorId: used.playerId,
    actorIsMe: true,
    actorName: players.find(p => p.id === used.playerId)?.name,
    revealedShellKind: used.revealedShellKind ?? null,
    healed: didHeal(used.healedTo, players.find(p => p.id === used.playerId)?.lives),
  };
}
