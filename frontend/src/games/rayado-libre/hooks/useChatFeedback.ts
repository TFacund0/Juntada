import { useEffect, useRef, useState } from "react";
import type { ChatEntry } from "../types/roundView";
import type { RayadoSfx } from "./useRayadoSfx";

// El "cerca" viaja en la vista privada (`private_role`), que el servidor
// manda justo después del estado público con el mensaje: se espera un
// instante antes de sonar "mine" para no tocarlo en un intento que un
// momento después resulta ser "cerca" (que tiene su propio sonido).
const MINE_SOUND_DELAY_MS = 150;

const maxId = (ids: readonly number[]) => (ids.length > 0 ? Math.max(...ids) : 0);

interface ChatFeedbackInput {
  chatLog: readonly ChatEntry[];
  myId: string | undefined;
  closeEntryIds: readonly number[];
  sfx: RayadoSfx;
  /** Ver useAnimationGate: nada suena por lo que pasó con la pestaña oculta. */
  canAnimate: () => boolean;
}

/**
 * Sonidos del chat de respuestas: mensaje de otro (`msg`), propio (`mine`),
 * "cerca" (`close`) y acierto de otro (`otherOk`) — solo por lo que llega en
 * vivo, nunca por el historial que ya estaba al montar. Devuelve un contador
 * que sube con cada "cerca" propio, para que el input tiemble.
 */
export function useChatFeedback({ chatLog, myId, closeEntryIds, sfx, canAnimate }: ChatFeedbackInput): number {
  const lastEntryId = useRef(maxId(chatLog.map(e => e.id)));
  const lastCloseId = useRef(maxId(closeEntryIds));
  const closeIds = useRef(closeEntryIds);
  const mineTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [closeShake, setCloseShake] = useState(0);

  useEffect(() => {
    closeIds.current = closeEntryIds;
  }, [closeEntryIds]);

  useEffect(() => () => clearTimeout(mineTimer.current), []);

  useEffect(() => {
    const fresh = chatLog.filter(e => e.id > lastEntryId.current);
    if (fresh.length === 0) return;
    lastEntryId.current = maxId(fresh.map(e => e.id));
    if (!canAnimate()) return;

    const others = fresh.filter(e => e.playerId !== myId);
    if (others.some(e => e.type === "correct")) sfx.play("otherOk");
    else if (others.length > 0) sfx.play("msg");

    const mine = fresh.filter(e => e.playerId === myId && e.type === "chat").map(e => e.id);
    if (mine.length === 0) return;
    clearTimeout(mineTimer.current);
    mineTimer.current = setTimeout(() => {
      if (mine.some(id => !closeIds.current.includes(id))) sfx.play("mine");
    }, MINE_SOUND_DELAY_MS);
  }, [chatLog, myId, sfx, canAnimate]);

  useEffect(() => {
    const fresh = closeEntryIds.filter(id => id > lastCloseId.current);
    if (fresh.length === 0) return;
    lastCloseId.current = maxId(fresh);
    if (!canAnimate()) return;
    sfx.play("close");
    setCloseShake(n => n + 1);
  }, [closeEntryIds, sfx, canAnimate]);

  return closeShake;
}
