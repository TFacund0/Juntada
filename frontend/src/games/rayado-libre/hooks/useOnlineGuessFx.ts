import { useMemo, type RefObject } from "react";
import { avatarColor } from "../../../components/ui/Avatar";
import { useAnimationGate } from "../../../components/game-kit/hooks/useAnimationGate";
import type { RoundViewProps } from "../../gameTypes";
import type { ChatEntry } from "../types/roundView";
import type { RayadoSfx } from "./useRayadoSfx";
import { useFxLayer } from "./useFxLayer";
import { useGuessFx } from "./useGuessFx";
import { onlineGuessEvents } from "../utils/guessEvents";

interface OnlineGuessFxInput {
  rootRef: RefObject<HTMLElement | null>;
  chatLog: readonly ChatEntry[];
  players: RoundViewProps["room"]["players"];
  roundPoints: Record<string, number>;
  myId: string | undefined;
  isDrawer: boolean;
  sfx: RayadoSfx;
}

/** Los efectos de cada acierto que llega por el chat online (ver useGuessFx); el ding doble de los ajenos ya lo toca el chat (useChatFeedback). */
export function useOnlineGuessFx({ rootRef, chatLog, players, roundPoints, myId, isDrawer, sfx }: OnlineGuessFxInput): void {
  const fx = useFxLayer();
  const canAnimate = useAnimationGate();
  const guesses = useMemo(
    () => onlineGuessEvents({ chatLog, players, roundPoints, myId, colorOf: avatarColor }),
    [chatLog, players, roundPoints, myId],
  );
  useGuessFx({ guesses, iAmDrawer: isDrawer, rootRef, sfx, fx, canAnimate, otherSound: false });
}
