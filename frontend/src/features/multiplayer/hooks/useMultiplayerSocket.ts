import { useState, useRef, useCallback, useEffect } from "react";
import type { ClientMessage, RoomPublicState, GroupPublicState } from "@juntada/shared-types";
import { useFlashError } from "../../../hooks/ui/useFlashError";
import { MAX_RECONNECT_ATTEMPTS } from "../services/socketConfig";
import { clearMultiplayerSession } from "../services/multiplayerSession";
import { createMultiplayerSocketService, type MultiplayerSocketService } from "../services/multiplayerSocketService";
import {
  parseInboundMessage,
  dispatchInboundMessage,
  type InboundMessageContext,
  type RoomPreview,
} from "../services/multiplayerMessageHandlers";
import { useMultiplayerSession } from "./useMultiplayerSession";
import { useReconnectOverlay, type OverlayMode } from "./useReconnectOverlay";
import { getAccessToken } from "../../auth/context/AuthContext";

// What SessionRecoveryOverlay should show, if anything — see useReconnectOverlay.
export type { OverlayMode };

// Result of the join screen's live "check_room_code" lookup — see roomPreview.
// Canonical definition lives in services/multiplayerMessageHandlers.ts (the
// React-free dispatcher needs it too); re-exported here so existing
// consumers (e.g. RoomEntryCard) keep importing it from this hook.
export type { RoomPreview };

export { clearMultiplayerSession };

// Encapsulates the WebSocket connection lifecycle (connect, reconnect/rejoin,
// message dispatch) so the UI component only deals with plain state. The
// actual socket construction, reconnect backoff, and watchdog interval live
// in services/multiplayerSocketService.ts — a React-free factory instantiated
// once per hook instance (see serviceRef below) and fed getters so it never
// closes over stale state. `onLeftGroup` fires once, right when a
// `left_group` confirmation comes in — the caller (MultiplayerGame) uses it
// to tell App.tsx to leave the whole group flow, since "menu" alone doesn't
// distinguish that from the very first screen before ever joining anything.
//
// Flat composition root modeled on hooks/app/useAppOrchestration.ts: fixed
// call order, leaf hooks called unconditionally at the top, destructured
// locally, flat 24-field return with no per-hook namespacing. Three units
// are wired in: services/multiplayerMessageHandlers.ts (React-free inbound
// dispatch, driven by the InboundMessageContext port), useMultiplayerSession
// (session persistence + hasActiveSession), and useReconnectOverlay
// (reconnect/cold-start/overlay state machine + its three named timers).
// Remaining view state (connectionPhase, room, group, myRole, wordReveal,
// roomPreview) stays here — it's plain setter-only state with no logic, and
// splitting it out would add a fourth unit outside this refactor's scope.
export function useMultiplayerSocket({ onLeftGroup, entryKind }: { onLeftGroup?: () => void; entryKind?: "room" | "group" } = {}) {
  // 1. View state + refs that mirror it for stable-closure readers.
  const [connectionPhase, setConnectionPhase] = useState("menu");
  const [room, setRoom] = useState<RoomPublicState | null>(null);
  const [group, setGroup] = useState<GroupPublicState | null>(null);
  const [myRole, setMyRole] = useState<Record<string, unknown> | null>(null); // { isImpostor, word, hint }
  const [wordReveal, setWordReveal] = useState<Record<string, unknown> | null>(null);
  // Result of the join screen's live "check_room_code" lookup — a read-only
  // preview of what a typed code points to, shown before the player commits
  // to actually joining (see MenuScreen's join-room form).
  const [roomPreview, setRoomPreview] = useState<RoomPreview | null>(null);
  const roomRef = useRef<RoomPublicState | null>(null);
  const onLeftGroupRef = useRef(onLeftGroup);
  onLeftGroupRef.current = onLeftGroup;
  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  const readRoom = useCallback(() => roomRef.current, []);

  // 2. Flash-error banner (used both by ctx.flashError below and directly by send()).
  const [error, errorKey, setErrorExternal] = useFlashError(5000);
  const flashError = setErrorExternal;
  const clearError = useCallback(() => setErrorExternal(""), [setErrorExternal]);

  // A centered dialog for "you were just kicked" (see ctx.setKickedNotice in
  // multiplayerMessageHandlers.ts) — kicked/kicked_from_group also redirect
  // away from the current screen, so a self-timing flash banner risks being
  // gone (or on a screen that's already unmounting) by the time the player
  // actually sees it. Dismissed explicitly by the dialog's own button.
  const [kickedNotice, setKickedNotice] = useState<string | null>(null);
  // Set by markGroupKicked (kicked_from_group) so dismissing the dialog is
  // what actually leaves the group flow — see notifyLeftGroup below.
  const groupKickedRef = useRef(false);
  const dismissKickedNotice = useCallback(() => {
    setKickedNotice(null);
    if (groupKickedRef.current) {
      groupKickedRef.current = false;
      onLeftGroupRef.current?.();
    }
  }, []);

  // 3. Declared here, constructed at step 6 — so useReconnectOverlay (step 5)
  // can close over `() => serviceRef.current?.resetReconnect()` without a
  // construction-order cycle (see design's Composition Root Call Order).
  const serviceRef = useRef<MultiplayerSocketService | null>(null);
  const resetReconnect = useCallback(() => {
    serviceRef.current?.resetReconnect();
  }, []);

  // 4. Session persistence (me/groupMe + their mirroring refs, hasActiveSession,
  // getRejoinMessage, entryKind-derived enabled flags).
  const session = useMultiplayerSession({ entryKind });
  const { me, setMe, groupMe, setGroupMe, groupSessionEnabled, roomSessionEnabled } = session;

  // 5. Reconnect/cold-start/overlay state machine + its three named timers.
  const overlay = useReconnectOverlay({
    initialColdStart: session.initialColdStart,
    hasPersistedRoom: Boolean(session.initialSessionRef.current?.room),
    readRoom,
    setConnectionPhase,
    resetReconnect,
  });

  // 6. The port fed to dispatchInboundMessage (services/multiplayerMessageHandlers.ts)
  // — built once via lazy useRef since every member below is a stable
  // identity (setState, useCallback with stable deps, or a ref reader). The
  // service captures onMessage exactly once at construction, so a useMemo
  // re-creation here would silently be ignored — see design's ctxRef section.
  const ctxRef = useRef<InboundMessageContext | null>(null);
  if (ctxRef.current === null) {
    ctxRef.current = {
      setMe,
      setGroupMe,
      readMe: session.readMe,
      readGroupMe: session.readGroupMe,
      readGroupSessionEnabled: session.readGroupSessionEnabled,
      setConnectionPhase,
      setRoom,
      setGroup,
      setMyRole,
      setWordReveal,
      setRoomPreview,
      readRoom,
      notifyLeftGroup: () => onLeftGroupRef.current?.(),
      markGroupKicked: () => {
        groupKickedRef.current = true;
      },
      isColdStart: overlay.isColdStart,
      onReconnected: overlay.onReconnected,
      resolveColdStart: overlay.resolveColdStart,
      settleGroupColdStart: overlay.settleGroupColdStart,
      cancelJoinFallbacks: overlay.cancelJoinFallbacks,
      scheduleGroupPhaseFallback: overlay.scheduleGroupPhaseFallback,
      endColdStart: overlay.endColdStart,
      markSessionGone: overlay.markSessionGone,
      stopReconnecting: overlay.stopReconnecting,
      abandonReconnect: overlay.abandonReconnect,
      flashError,
      clearError,
      setKickedNotice,
    };
  }

  // Every server message the service hands back as a raw string — parses it
  // and delegates to the React-free dispatch table in
  // services/multiplayerMessageHandlers.ts. Captured once into the service's
  // config (see serviceRef below): ctxRef.current is a stable identity, so
  // this stays correct across renders without needing to be recreated.
  function handleInboundMessage(raw: string): void {
    const msg = parseInboundMessage(raw);
    if (msg) dispatchInboundMessage(msg, ctxRef.current!);
  }

  // The socket lifecycle service — created exactly once via this useRef
  // lazy initializer and never recreated. Fed useMultiplayerSession's stable
  // getRejoinMessage/readHasActiveSession (which close over its own
  // meRef/groupMeRef/entryKind-derived refs), so it always reads the hook's
  // latest session state without going stale despite outliving every render.
  if (serviceRef.current === null) {
    serviceRef.current = createMultiplayerSocketService({
      getRejoinMessage: session.getRejoinMessage,
      shouldReconnect: session.readHasActiveSession,
      getAccessToken,
      onMessage: handleInboundMessage,
      onClose: overlay.onSocketClosed,
      onError: () => flashError("No se pudo conectar al servidor"),
      onReconnectAttempt: overlay.setReconnectAttempt,
      onReconnectFailed: overlay.onReconnectGivenUp,
      // Another device took over this account's seat (close 4001) — do NOT
      // auto-reconnect (see multiplayerSocketService.ts's comment), just
      // tell the player and drop back to the menu like an explicit leave.
      onSessionReplaced: () => {
        flashError("Tu cuenta se conectó desde otro dispositivo");
        setConnectionPhase("menu");
      },
    });
  }

  // 7. connect/retryConnection/send/leave callbacks, then lifecycle effects.
  const connect = useCallback((onOpen?: (ws: WebSocket) => void) => {
    serviceRef.current!.connect(onOpen);
  }, []);

  const retryConnection = useCallback(() => {
    overlay.retryReset();
    serviceRef.current!.connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-rejoin a persisted session on mount (covers the case where the
  // mobile browser fully discarded the page while backgrounded, so the app
  // remounted from scratch instead of just dropping the socket).
  useEffect(() => {
    if (session.readHasActiveSession()) serviceRef.current!.connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timers/sockets get throttled or suspended while a mobile tab is in the
  // background. Rather than waiting for the passive onclose+backoff retry
  // (which may be delayed well past when the user actually comes back),
  // proactively check the connection the moment the tab becomes visible
  // again — and don't just trust a stale-looking OPEN readyState either (see
  // service.isStale(), which mirrors the watchdog's own staleness check),
  // since a phone that lost signal while backgrounded is exactly the case
  // this needs to catch. Stays in the hook (DOM listeners are React's
  // concern) but delegates the actual connection checks/actions to the
  // service.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !session.readHasActiveSession()) return;
      if (!serviceRef.current!.isOpen()) {
        // Same optimistic flag as retryConnection: if the socket died while
        // the tab was backgrounded but its throttled onclose hasn't actually
        // fired yet, reconnecting is still false here — without this, the
        // overlay would briefly drop (overlayMode falls through to "none")
        // right as the player switches back, flashing the stale game screen
        // for a frame before onclose/onReconnected catches up.
        overlay.setReconnecting(true);
        serviceRef.current!.connect();
      } else if (serviceRef.current!.isStale()) {
        serviceRef.current!.closeSocket();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupSessionEnabled, roomSessionEnabled]);

  useEffect(
    () => () => {
      serviceRef.current!.dispose();
    },
    [],
  );

  const send = useCallback((msg: ClientMessage | Record<string, unknown>) => {
    if (!serviceRef.current!.send(msg)) flashError("Sin conexión con el servidor");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Explicit leave (kicked, "Menú principal", etc.) should forget the
  // session so a later fresh visit doesn't try to rejoin a room/group the
  // player deliberately left.
  const leave = useCallback(() => {
    serviceRef.current!.closeSocket();
    serviceRef.current!.resetReconnect();
    overlay.reset();
    setMe(null);
    setRoom(null);
    setMyRole(null);
    setGroupMe(null);
    setGroup(null);
    setConnectionPhase("menu");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 8. Flat 24-field return — overlayMode/confirmRejoin come straight off overlay.
  return {
    connectionPhase,
    setConnectionPhase,
    me,
    room,
    groupMe,
    group,
    myRole,
    wordReveal,
    roomPreview,
    setRoomPreview,
    error,
    errorKey,
    setError: setErrorExternal,
    kickedNotice,
    dismissKickedNotice,
    reconnecting: overlay.reconnecting,
    reconnectAttempt: overlay.reconnectAttempt,
    reconnectFailed: overlay.reconnectFailed,
    justReconnected: overlay.justReconnected,
    overlayMode: overlay.overlayMode,
    confirmRejoin: overlay.confirmRejoin,
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
    connect,
    retryConnection,
    send,
    leave,
  };
}
