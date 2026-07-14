import { useState, useRef, useCallback, useEffect } from "react";
import type { ClientMessage, RoomPublicState, GroupPublicState, ErrorCode } from "@juntada/shared-types";

// In dev, Vite (5173) and the backend (3001) run as separate servers, so the
// socket has to point at the backend explicitly. In production a single
// server serves the built frontend and the WS endpoint from the same origin.
const WS_URL = import.meta.env.DEV
  ? `ws://${window.location.hostname}:${import.meta.env.VITE_BACKEND_PORT || 3001}`
  : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;

// Stops the automatic retry loop after this many failed attempts so a
// truly-gone connection doesn't retry silently forever — the UI offers a
// manual "reintentar"/"volver al menú" choice once this is hit instead.
const MAX_RECONNECT_ATTEMPTS = 10;
// Backoff between retries: starts at 3s, grows by 600ms per attempt, caps
// at 8s — gentler on a flaky connection (and the server) than hammering
// every 3s indefinitely, while still recovering quickly from a brief drop.
function reconnectDelayMs(attempt: number): number {
  return Math.min(3000 + (attempt - 1) * 600, 8000);
}

// Backgrounding the tab on mobile (switching to WhatsApp, locking the screen,
// etc.) can kill the socket or even discard the JS context entirely. We
// persist just enough identity to rejoin the same room/group after either
// case — the server already keeps a disconnected player's slot reserved
// (marked offline, not removed) for a grace period, so this is what lets the
// client actually make use of that instead of dumping the player back at the
// menu.
//
// A client can be:
//   - standalone-room-attached only: room session, no group session.
//   - group-attached, no active instance: group session, no room session.
//   - group-attached with an active instance: both sessions set, same playerId.
const SESSION_KEY = "impostorgame:session";

interface RoomSession {
  playerId: string;
  roomCode: string;
}

interface GroupSession {
  playerId: string;
  groupCode: string;
}

interface PersistedSession {
  room?: RoomSession;
  group?: GroupSession;
}

function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session: PersistedSession | null): void {
  try {
    if (session && (session.room || session.group)) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable (private mode, etc.) — degrade silently */
  }
}

// Exposed so the root app can drop a persisted session when the player
// deliberately navigates away (back to menu, picks a different game), rather
// than leaving it around to be wrongly auto-rejoined on a later visit.
export function clearMultiplayerSession(): void {
  saveSession(null);
}

// The server messages this hook reacts to (see backend/src/ws/messaging.ts
// and each engine's getRevealMessage) — private_role and word_reveal payload
// shapes are per-engine, not yet a clean discriminated union (see
// @juntada/shared-types's ServerMessage comment), so they stay loose here too.
type InboundMessage =
  | { type: "joined"; playerId: string; roomCode: string; room: RoomPublicState }
  | { type: "state"; room: RoomPublicState }
  | { type: "group_joined"; playerId: string; groupCode: string; group: GroupPublicState }
  | { type: "group_state"; group: GroupPublicState }
  | { type: "left_instance" }
  | { type: "left_group" }
  | { type: "private_role"; [key: string]: unknown }
  | { type: "word_reveal"; [key: string]: unknown }
  | { type: "error"; code: ErrorCode; message: string }
  | { type: "kicked" }
  | { type: "room_preview"; code: string; found: boolean; name?: string; gameType?: string };

// Encapsulates the WebSocket connection lifecycle (connect, reconnect/rejoin,
// message dispatch) so the UI component only deals with plain state.
// `onLeftGroup` fires once, right when a `left_group` confirmation comes in
// — the caller (MultiplayerGame) uses it to tell App.tsx to leave the whole
// group flow, since "menu" alone doesn't distinguish that from the very
// first screen before ever joining anything.
export function useMultiplayerSocket({
  onLeftGroup,
  entryKind,
}: { onLeftGroup?: () => void; entryKind?: "room" | "group" } = {}) {
  // menu|create|join, then mirrors room.phase directly ("lobby" and whatever
  // in-game phases the active game defines — this hook doesn't know or care
  // what those are) once a room is attached, or "group" once a group is
  // attached with no active instance.
  const [connectionPhase, setConnectionPhase] = useState("menu");
  const [me, setMe] = useState<RoomSession | null>(() => loadSession()?.room ?? null);
  const [groupMe, setGroupMe] = useState<GroupSession | null>(() => loadSession()?.group ?? null);
  // A persisted group session should only drive auto-rejoin behavior when
  // this screen was actually opened for the group flow — otherwise a stale
  // group session from a past visit races its own rejoin_group against this
  // screen's create_room/join_room on mount, and whichever socket loses gets
  // orphaned mid-handshake (surfaces as a bogus "No se pudo conectar al
  // servidor"). The session itself is still kept/persisted untouched so a
  // real group elsewhere isn't affected by visiting a standalone room.
  const groupSessionEnabled = entryKind !== "room";
  const [room, setRoom] = useState<RoomPublicState | null>(null);
  const [group, setGroup] = useState<GroupPublicState | null>(null);
  const [myRole, setMyRole] = useState<Record<string, unknown> | null>(null); // { isImpostor, word, hint }
  const [wordReveal, setWordReveal] = useState<Record<string, unknown> | null>(null);
  // Result of the join screen's live "check_room_code" lookup — a read-only
  // preview of what a typed code points to, shown before the player commits
  // to actually joining (see MultiplayerGame's join-room form).
  const [roomPreview, setRoomPreview] = useState<{ code: string; found: boolean; name?: string; gameType?: string } | null>(null);
  const [error, setError] = useState("");
  // True while a dropped socket is being retried in the background (flaky
  // connection, tab was suspended, etc.) — lets the UI show a "reconectando"
  // banner instead of silently retrying with no feedback.
  const [reconnecting, setReconnecting] = useState(false);
  // How many attempts have been made since the socket last dropped — shown
  // in the UI so a long reconnect doesn't look frozen, and used to decide
  // when to give up (see MAX_RECONNECT_ATTEMPTS below).
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
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectedBannerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meRef = useRef(me);
  const groupMeRef = useRef(groupMe);
  const roomRef = useRef<RoomPublicState | null>(null);
  const reconnectingRef = useRef(false);
  const onLeftGroupRef = useRef(onLeftGroup);
  onLeftGroupRef.current = onLeftGroup;

  useEffect(() => {
    meRef.current = me;
    saveSession({ room: me ?? undefined, group: groupMeRef.current ?? undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);
  useEffect(() => {
    groupMeRef.current = groupMe;
    saveSession({ room: meRef.current ?? undefined, group: groupMe ?? undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupMe]);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  useEffect(() => {
    reconnectingRef.current = reconnecting;
  }, [reconnecting]);

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
  }, []);

  const connect = useCallback((onOpen?: (ws: WebSocket) => void) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      onOpen?.(wsRef.current);
      return;
    }
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => {
      if (onOpen) onOpen(ws);
      else if (groupSessionEnabled && groupMeRef.current)
        ws.send(JSON.stringify({ type: "rejoin_group", groupCode: groupMeRef.current.groupCode, playerId: groupMeRef.current.playerId }));
      else if (meRef.current) ws.send(JSON.stringify({ type: "rejoin", roomCode: meRef.current.roomCode, playerId: meRef.current.playerId }));
    };
    ws.onmessage = e => {
      let msg: InboundMessage;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.type === "joined") {
        setMe({ playerId: msg.playerId, roomCode: msg.roomCode });
        setRoom(msg.room);
        setConnectionPhase(msg.room.phase);
        setError("");
        onReconnected();
      } else if (msg.type === "state") {
        setRoom(msg.room);
        setConnectionPhase(msg.room.phase);
        setError("");
        onReconnected();
      } else if (msg.type === "group_joined") {
        setGroupMe({ playerId: msg.playerId, groupCode: msg.groupCode });
        setGroup(msg.group);
        // A rejoin_group may be immediately followed by a "joined" for a
        // still-live instance — don't force the group screen if that's
        // about to happen; only switch phase here if we're not already
        // sitting on a room (a plain group_state update from the group
        // screen itself takes this branch too, harmlessly).
        setRoom(prevRoom => {
          if (!prevRoom) setConnectionPhase("group");
          return prevRoom;
        });
        setError("");
        onReconnected();
      } else if (msg.type === "group_state") {
        setGroup(msg.group);
        setError("");
        onReconnected();
      } else if (msg.type === "left_instance") {
        setMe(null);
        setRoom(null);
        setMyRole(null);
        setWordReveal(null);
        setConnectionPhase("group");
        setError("");
      } else if (msg.type === "left_group") {
        setMe(null);
        setRoom(null);
        setGroupMe(null);
        setGroup(null);
        setMyRole(null);
        setWordReveal(null);
        setConnectionPhase("menu");
        setError("");
        onLeftGroupRef.current?.();
      } else if (msg.type === "private_role") {
        setMyRole(msg);
        setWordReveal(null);
      } else if (msg.type === "word_reveal") {
        setWordReveal(msg);
      } else if (msg.type === "error") {
        setError(msg.message);
        // Failed before ever landing in a room/group — either a fresh
        // join with a bad code, or a restored/rejoin session whose
        // room/group has since expired. Either way, never leave the UI
        // stuck: drop the stale session and send them back to the menu
        // instead of an infinite "Conectando..." with nothing to rejoin.
        if (!roomRef.current && !groupMeRef.current) {
          setMe(null);
          setRoom(null);
          setConnectionPhase(prev => (prev === "menu" || prev === "create" || prev === "join" ? prev : "join"));
        } else if (!roomRef.current && groupMeRef.current && msg.code === "REJOIN_GROUP_FAILED") {
          setGroupMe(null);
          setGroup(null);
          setConnectionPhase("menu");
        }
      } else if (msg.type === "room_preview") {
        setRoomPreview(msg);
      } else if (msg.type === "kicked") {
        setConnectionPhase(groupMeRef.current ? "group" : "menu");
        setMe(null);
        setRoom(null);
        setMyRole(null);
        setError("Fuiste expulsado de la sala");
        setReconnecting(false);
      }
    };
    ws.onclose = () => {
      if (!meRef.current && !(groupSessionEnabled && groupMeRef.current)) return;
      setReconnecting(true);
      // A fresh drop mid-retry-loop shouldn't still show a stale
      // "Reconectado" from an earlier, unrelated recovery.
      setJustReconnected(false);
      if (reconnectedBannerRef.current) clearTimeout(reconnectedBannerRef.current);
      setReconnectAttempt(prevAttempt => {
        const attempt = prevAttempt + 1;
        if (attempt > MAX_RECONNECT_ATTEMPTS) {
          setReconnecting(false);
          setReconnectFailed(true);
          return prevAttempt;
        }
        reconnectRef.current = setTimeout(() => {
          if (meRef.current || (groupSessionEnabled && groupMeRef.current)) connect();
        }, reconnectDelayMs(attempt));
        return attempt;
      });
    };
    ws.onerror = () => setError("No se pudo conectar al servidor");
  }, [onReconnected]);

  // Manual retry after the automatic loop gave up (see reconnectFailed) —
  // resets the attempt count/backoff so the player gets a fresh full run
  // of retries rather than picking up where the exhausted loop left off.
  const retryConnection = useCallback(() => {
    setReconnectFailed(false);
    setReconnectAttempt(0);
    connect();
  }, [connect]);

  // Auto-rejoin a persisted session on mount (covers the case where the
  // mobile browser fully discarded the page while backgrounded, so the app
  // remounted from scratch instead of just dropping the socket).
  useEffect(() => {
    if (meRef.current || (groupSessionEnabled && groupMeRef.current)) connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timers/sockets get throttled or suspended while a mobile tab is in the
  // background. Rather than waiting for the passive onclose+3s retry (which
  // may be delayed well past when the user actually comes back), proactively
  // check the connection the moment the tab becomes visible again.
  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        (meRef.current || (groupSessionEnabled && groupMeRef.current)) &&
        wsRef.current?.readyState !== WebSocket.OPEN
      ) {
        if (reconnectRef.current) clearTimeout(reconnectRef.current);
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [connect]);

  useEffect(
    () => () => {
      wsRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (reconnectedBannerRef.current) clearTimeout(reconnectedBannerRef.current);
    },
    [],
  );

  const send = useCallback((msg: ClientMessage | Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    else setError("Sin conexión con el servidor");
  }, []);

  // Explicit leave (kicked, "Menú principal", etc.) should forget the
  // session so a later fresh visit doesn't try to rejoin a room/group the
  // player deliberately left.
  const leave = useCallback(() => {
    wsRef.current?.close();
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    if (reconnectedBannerRef.current) clearTimeout(reconnectedBannerRef.current);
    setMe(null);
    setRoom(null);
    setMyRole(null);
    setGroupMe(null);
    setGroup(null);
    setConnectionPhase("menu");
    setReconnecting(false);
    setReconnectAttempt(0);
    setReconnectFailed(false);
    setJustReconnected(false);
  }, []);

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
    setError,
    reconnecting,
    reconnectAttempt,
    reconnectFailed,
    justReconnected,
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
    connect,
    retryConnection,
    send,
    leave,
  };
}
