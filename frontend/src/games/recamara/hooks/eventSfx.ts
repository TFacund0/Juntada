import { useEffect, useRef } from "react";
import type { ItemKind } from "@juntada/recamara-engine";
import type { SfxName } from "../utils/sfx";
import type { PlayingFx } from "../utils/playingFx";
import type { FireStage } from "./shotAnimation";
import type { RecamaraSfx } from "./recamaraSfx";

// Plays the sound and vibration for whatever the event director is staging,
// timed to the same beats as the animation (see useEventDirector): heartbeat
// while aiming, bang or dry click on the trigger, then the pump racking the
// empty casing onto the table. Shared by LocalGame and RoundView so both
// sound identical.

const ITEM_SFX: Partial<Record<ItemKind, SfxName>> = { "🪚": "saw", "🔍": "lens", "🚬": "puff" };

export function useEventSfx(event: PlayingFx | null, fireStage: FireStage, sfx: RecamaraSfx): void {
  const latest = useRef({ event, sfx });
  useEffect(() => {
    latest.current = { event, sfx };
  });
  const aimedId = useRef<number | null>(null);
  const firedId = useRef<number | null>(null);

  // A new event just started: the aim heartbeat for a shot, the item's own
  // sound for an item.
  useEffect(() => {
    const { event: ev, sfx: out } = latest.current;
    if (!ev || aimedId.current === ev.id) return;
    aimedId.current = ev.id;
    if (ev.kind === "item") {
      out.play((ev.item && ITEM_SFX[ev.item]) ?? "pop");
      return;
    }
    out.play("thump");
    out.play("thump", 0.5);
    out.play("thump", 0.95);
    if (ev.targetIsMe) out.vibrate([15, 480, 15, 430, 15]);
  }, [event?.id]);

  // The trigger: only once per shot, the moment the animation reaches it.
  useEffect(() => {
    const { event: ev, sfx: out } = latest.current;
    if (fireStage !== "firing" || !ev || ev.kind !== "shot" || firedId.current === ev.id) return;
    firedId.current = ev.id;
    const live = ev.shellKind === "live";
    out.play(live ? "bang" : "click");
    const rackAt = live ? 0.38 : 0.26;
    out.play("rack", rackAt);
    out.play("clink", rackAt + 0.62);
    out.play("clink", rackAt + 0.8);
    if (live) out.vibrate(ev.targetIsMe ? [90, 40, 200] : 60);
    else if (ev.targetIsMe) out.vibrate(20);
  }, [fireStage, event?.id]);
}
