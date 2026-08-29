import { useState, useRef, useCallback, useEffect } from "react";
import type { RoomPublicState } from "@juntada/shared-types";
import { GROUP_JOINED_FALLBACK_MS } from "../services/socketConfig";

export type OverlayMode = "none" | "connecting" | "prompt" | "reconnected" | "failed" | "gone";

interface UseReconnectOverlayArgs {
  initialColdStart: boolean;
  hasPersistedRoom: boolean;
  readRoom: () => RoomPublicState | null;
  setConnectionPhase: (next: string | ((prev: string) => string)) => void;
  resetReconnect: () => void;
}

// Owns everything about "is a dropped/cold-started connection being
// recovered, and what should SessionRecoveryOverlay show" — split out of
// useMultiplayerSocket.ts (see design's ownership-split table: state + its
// mirroring refs + all three named timeouts travel together). Nothing here
// talks to the socket/service directly beyond the injected `resetReconnect`
// getter; useMultiplayerSocket wires this hook's outputs into the
// InboundMessageContext port and the service's config callbacks.
export function useReconnectOverlay({
  initialColdStart,
  hasPersistedRoom,
  readRoom,
  setConnectionPhase,
  resetReconnect,
}: UseReconnectOverlayArgs) {
  // True while a dropped socket is being retried in the background (flaky
  // connection, tab was suspended, etc.) — lets the UI show a "reconectando"
  // banner instead of silently retrying with no feedback.
  const [reconnecting, setReconnecting] = useState(false);
  // How many attempts have been made since the socket last dropped — shown
  // in the UI so a long reconnect doesn't look frozen, and used to decide
  // when to give up. The service owns the authoritative counter; this
  // mirrors it for the UI.
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  // True once MAX_RECONNECT_ATTEMPTS is exhausted with no successful
  // reconnect — stops the retry loop and lets the UI offer a manual
  // "reintentar"/"volver al menú" choice instead of retrying forever
  // in silence.
  const [reconnectFailed, setReconnectFailed] = useState(false);
  // Briefly true right after a reconnect that followed a real drop (not the
  // very first connect) — lets the UI flash a "Reconectado" confirmation
  // instead of the banner just vanishing with no acknowledgment.
  const [justReconnected, setJustReconnected] = useState(false);
  // True from mount whenever a persisted session was found in localStorage,
  // until it's been resolved one way or another — drives the full-screen
  // "Autenticando sesión..." gate (SessionRecoveryOverlay) instead of letting
  // the player see the menu/lobby flash by underneath while the rejoin
  // round-trip is still in flight. Seeded from the composition root's
  // useMultiplayerSession().initialColdStart.
  const [coldStart, setColdStart] = useState(initialColdStart);
  // True once the cold-start rejoin lands on an in-progress game — instead of
  // silently dropping the player back into the round, the overlay asks
  // explicitly ("Reconectar a la partida" / "Volver al menú principal") since
  // a stale tab jumping straight back into a live vote is more disorienting
  // than reassuring.
  const [rejoinChoicePending, setRejoinChoicePending] = useState(false);
  // True once a rejoin attempt (cold start or a live drop reconnecting mid-
  // game) comes back with REJOIN_FAILED/REJOIN_GROUP_FAILED — the room/group
  // itself is gone (host ended it, expired while this player was offline),
  // not just a flaky connection, so there's nothing left to retry. Drives
  // the overlay's "gone" mode: an explicit "esta sala ya no existe" screen
  // with only a way back to the menu, instead of silently dropping into the
  // join form with just an easy-to-miss toast.
  const [sessionGone, setSessionGone] = useState(false);

  const coldStartRef = useRef(coldStart);
  const reconnectingRef = useRef(reconnecting);
  useEffect(() => {
    coldStartRef.current = coldStart;
  }, [coldStart]);
  useEffect(() => {
    reconnectingRef.current = reconnecting;
  }, [reconnecting]);

  // Fallback for a group-attached cold start: group_joined/group_state waits
  // for a "joined" that only arrives if the persisted instance is still
  // live. If it ended while this player was offline, no "joined" is ever
  // coming — without this timeout the overlay would sit on "Autenticando"
  // forever instead of falling through to the group screen.
  const groupJoinedFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Same "wait a beat for joined before flipping the visible phase" idea as
  // groupJoinedFallbackRef, but for a hot reconnect rather than cold start:
  // a rejoin_group that still remembers a room is expected to get a "joined"
  // right behind group_joined. Without this, the two arriving as separate WS
  // message events (not guaranteed to land in the same React batch) flashes
  // the group screen before "joined" replaces it with the room.
  const groupPhaseFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectedBannerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Called on any message that confirms the connection is actually working
  // again (joined/state/group_joined/group_state/kicked all count — a
  // response of any kind proves the round trip works). Only flashes the
  // "Reconectado" confirmation if we were actually mid-reconnect, not on
  // the very first connect of a session.
  const onReconnected = useCallback(() => {
    if (reconnectingRef.current) {
      setJustReconnected(true);
      if (reconnectedBannerRef.current) clearTimeout(reconnectedBannerRef.current);
      reconnectedBannerRef.current = setTimeout(() => setJustReconnected(false), 3000);
    }
    setReconnecting(false);
    setReconnectAttempt(0);
    setReconnectFailed(false);
    resetReconnect();
  }, [resetReconnect]);

  // Called whenever a message arrives that could settle the cold-start gate.
  // `phase` is the room phase this message carries, if any — "lobby" (or no
  // room at all) resolves immediately since there's nothing mid-game to ask
  // about; anything else means a live round, so it waits for an explicit
  // choice instead.
  const resolveColdStart = useCallback((phase?: string) => {
    if (!coldStartRef.current) return;
    if (phase && phase !== "lobby") setRejoinChoicePending(true);
    else setColdStart(false);
  }, []);

  // Shared by both group_joined and group_state (see GROUP_JOINED_FALLBACK_MS):
  // a persisted room session means a "joined" for the live instance is
  // expected right after either message — wait for that instead of
  // resolving the cold-start gate now and having it flicker away then back.
  // But that instance may have ended while this player was offline, in
  // which case no "joined" is ever coming, so a timeout is the only way out.
  const settleGroupColdStart = useCallback(() => {
    if (!hasPersistedRoom) {
      resolveColdStart();
      return;
    }
    if (!coldStartRef.current) return;
    if (groupJoinedFallbackRef.current) clearTimeout(groupJoinedFallbackRef.current);
    groupJoinedFallbackRef.current = setTimeout(() => {
      if (!readRoom()) resolveColdStart();
    }, GROUP_JOINED_FALLBACK_MS);
  }, [hasPersistedRoom, readRoom, resolveColdStart]);

  // Shared by handleJoined (via ctx.cancelJoinFallbacks): a "joined" landing
  // means neither group-cold-start fallback is still needed.
  const cancelJoinFallbacks = useCallback(() => {
    if (groupJoinedFallbackRef.current) {
      clearTimeout(groupJoinedFallbackRef.current);
      groupJoinedFallbackRef.current = null;
    }
    if (groupPhaseFallbackRef.current) {
      clearTimeout(groupPhaseFallbackRef.current);
      groupPhaseFallbackRef.current = null;
    }
  }, []);

  // See groupPhaseFallbackRef above — used from handleGroupJoined via
  // ctx.scheduleGroupPhaseFallback() when a hot reconnect still remembers a
  // room and should wait a beat for "joined" before flashing the group screen.
  const scheduleGroupPhaseFallback = useCallback(() => {
    if (groupPhaseFallbackRef.current) clearTimeout(groupPhaseFallbackRef.current);
    groupPhaseFallbackRef.current = setTimeout(() => {
      if (!readRoom()) setConnectionPhase("group");
    }, GROUP_JOINED_FALLBACK_MS);
  }, [readRoom, setConnectionPhase]);

  const isColdStart = useCallback(() => coldStartRef.current, []);
  const endColdStart = useCallback(() => setColdStart(false), []);
  const markSessionGone = useCallback(() => setSessionGone(true), []);
  const stopReconnecting = useCallback(() => setReconnecting(false), []);

  // Full 5-part reset used only by the REJOIN_FAILED/REJOIN_GROUP_FAILED
  // branch (see handleError in services/multiplayerMessageHandlers.ts) —
  // narrower than stopReconnecting, which kicked/kicked_from_group use.
  const abandonReconnect = useCallback(() => {
    setReconnecting(false);
    setReconnectAttempt(0);
    setReconnectFailed(false);
    setRejoinChoicePending(false);
    resetReconnect();
  }, [resetReconnect]);

  // Called from the service's onClose config callback: a fresh drop mid-
  // retry-loop shouldn't still show a stale "Reconectado" from an earlier,
  // unrelated recovery.
  const onSocketClosed = useCallback(() => {
    setReconnecting(true);
    setJustReconnected(false);
    if (reconnectedBannerRef.current) clearTimeout(reconnectedBannerRef.current);
  }, []);

  // Called from the service's onReconnectFailed config callback once the
  // automatic retry loop gives up.
  const onReconnectGivenUp = useCallback(() => {
    setReconnecting(false);
    setReconnectFailed(true);
  }, []);

  // Manual retry after the automatic loop gave up — resets the
  // attempt count/backoff so the player gets a fresh full run of retries
  // rather than picking up where the exhausted loop left off. Optimistic
  // setReconnecting(true): `connect()` only flips it (via the service's
  // onclose) once the *new* socket itself drops, so without this there was a
  // gap — reconnectFailed already false, reconnecting still false — where
  // overlayMode fell through to "none", unmounting the gate and flashing the
  // game underneath for a frame before the socket's first event brought
  // "Autenticando" back.
  const retryReset = useCallback(() => {
    setReconnectFailed(false);
    setReconnectAttempt(0);
    setReconnecting(true);
    resetReconnect();
  }, [resetReconnect]);

  // The "rejoin" choice offered by SessionRecoveryOverlay once a cold-start
  // rejoin lands on a live round (see rejoinChoicePending above) — the
  // "decline" choice is just `leave` itself, same as every other "volver al
  // menú" path.
  const confirmRejoin = useCallback(() => {
    setColdStart(false);
    setRejoinChoicePending(false);
  }, []);

  // Consolidates the 3 ad-hoc clearTimeouts + 7 setters `leave()` used to do
  // inline into a single call.
  const reset = useCallback(() => {
    if (reconnectedBannerRef.current) clearTimeout(reconnectedBannerRef.current);
    if (groupJoinedFallbackRef.current) clearTimeout(groupJoinedFallbackRef.current);
    if (groupPhaseFallbackRef.current) clearTimeout(groupPhaseFallbackRef.current);
    setReconnecting(false);
    setReconnectAttempt(0);
    setReconnectFailed(false);
    setJustReconnected(false);
    setColdStart(false);
    setRejoinChoicePending(false);
    setSessionGone(false);
  }, []);

  // Single cleanup effect for all three named timeouts, mirrored from the
  // pre-refactor root's dispose effect.
  useEffect(
    () => () => {
      if (reconnectedBannerRef.current) clearTimeout(reconnectedBannerRef.current);
      if (groupJoinedFallbackRef.current) clearTimeout(groupJoinedFallbackRef.current);
      if (groupPhaseFallbackRef.current) clearTimeout(groupPhaseFallbackRef.current);
    },
    [],
  );

  // Priority order matters: sessionGone/reconnectFailed/justReconnected are
  // all terminal-ish states of a live reconnect and win over a stale
  // coldStart flag that just hasn't been cleared yet; rejoinChoicePending
  // only means anything while still mid coldStart.
  const overlayMode: OverlayMode = !(coldStart || reconnecting || reconnectFailed || justReconnected || sessionGone)
    ? "none"
    : sessionGone
      ? "gone"
      : reconnectFailed
        ? "failed"
        : justReconnected
          ? "reconnected"
          : rejoinChoicePending
            ? "prompt"
            : "connecting";

  return {
    reconnecting,
    reconnectAttempt,
    reconnectFailed,
    justReconnected,
    coldStart,
    rejoinChoicePending,
    sessionGone,
    overlayMode,
    confirmRejoin,
    setReconnecting,
    setReconnectAttempt,
    onReconnected,
    resolveColdStart,
    settleGroupColdStart,
    cancelJoinFallbacks,
    scheduleGroupPhaseFallback,
    isColdStart,
    endColdStart,
    markSessionGone,
    stopReconnecting,
    abandonReconnect,
    onSocketClosed,
    onReconnectGivenUp,
    retryReset,
    reset,
  };
}
