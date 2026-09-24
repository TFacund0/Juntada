import { useEffect, useRef } from "react";
import type { LastItemEvent, PendingFire, RecamaraRoundView } from "@juntada/recamara-engine";
import { classifyRoundUpdate, seqsOf, type RoundSeqs } from "../utils/roundUpdates";
import { seatAngle } from "../utils/arena";
import { useEventDirector, type EventDirector } from "./eventDirector";

export type OnlineDirector = EventDirector<RecamaraRoundView | null, PendingFire, LastItemEvent>;

// Feeds every server round update into the event director. The seq
// baseline is taken from the first round this component ever sees, so
// mounting mid-game (page reload, joining late) shows the current state as
// is instead of replaying the last stored shot or item.
export function useOnlineRoundDirector(round: RecamaraRoundView | null): OnlineDirector {
  const director = useEventDirector<RecamaraRoundView | null, PendingFire, LastItemEvent>(round, (shot, before) => {
    const view = before ?? round;
    const targetEngineId = view ? view.seatOrder.indexOf(shot.targetId) : -1;
    return { angle: view ? seatAngle(view.state.order, targetEngineId) : 0, shellKind: shot.shellKind };
  });
  const seqsRef = useRef<RoundSeqs | null>(round ? seqsOf(round) : null);

  useEffect(() => {
    if (!round) return;
    const update = classifyRoundUpdate(seqsRef.current, round);
    seqsRef.current = seqsOf(round);
    if (update === "shot" && round.pendingFire) director.enqueue({ kind: "shot", payload: round.pendingFire, after: round });
    else if (update === "item" && round.lastItemEvent) director.enqueue({ kind: "item", payload: round.lastItemEvent, after: round });
    else if (update === "sync") director.enqueue({ kind: "sync", after: round });
    else director.reset(round);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  return director;
}
