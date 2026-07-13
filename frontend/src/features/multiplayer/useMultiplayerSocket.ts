import { useState, useRef, useCallback, useEffect } from "react";
import type { ClientMessage, RoomPublicState, GroupPublicState, ErrorCode } from "@juntada/shared-types";

// In dev, Vite (5173) and the backend (3001) run as separate servers, so the
// socket has to point at the backend explicitly. In production a single
// server serves the built frontend and the WS endpoint from the same origin.
const WS_URL = import.meta.env.DEV
  ? `ws://${window.location.hostname}:${import.meta.env.VITE_BACKEND_PORT || 3001}`
  : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;

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
  | { type: "private_role"; [key: string]: unknown }
  | { type: "word_reveal"; [key: string]: unknown }
  | { type: "error"; code: ErrorCode; message: string }
  | { type: "kicked" };

// Encapsulates the WebSocket connection lifecycle (connect, reconnect/rejoin,
// message dispatch) so the UI component only deals with plain state.
export function useMultiplayerSocket() {
  // menu|create|join, then mirrors room.phase directly ("lobby" and whatever
  // in-game phases the active game defines — this hook doesn't know or care
  // what those are) once a room is attached, or "group" once a group is
  // attached with no active instance.
  const [connectionPhase, setConnectionPhase] = useState("menu");
  const [me, setMe] = useState<RoomSession | null>(() => loadSession()?.room ?? null);
  const [groupMe, setGroupMe] = useState<GroupSession | null>(() => loadSession()?.group ?? null);
  const [room, setRoom] = useState<RoomPublicState | null>(null);
  const [group, setGroup] = useState<GroupPublicState | null>(null);
  const [myRole, setMyRole] = useState<Record<string, unknown> | null>(null); // { isImpostor, word, hint }
  const [wordReveal, setWordReveal] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  // True while a dropped socket is being retried in the background (flaky
  // connection, tab was suspended, etc.) — lets the UI show a "reconectando"
  // banner instead of silently retrying with no feedback.
  const [reconnecting, setReconnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meRef = useRef(me);
  const groupMeRef = useRef(groupMe);
  const roomRef = useRef<RoomPublicState | null>(null);

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

  const connect = useCallback((onOpen?: (ws: WebSocket) => void) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      onOpen?.(wsRef.current);
      return;
    }
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => {
      if (onOpen) onOpen(ws);
      else if (groupMeRef.current)
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
        setReconnecting(false);
      } else if (msg.type === "state") {
        setRoom(msg.room);
        setConnectionPhase(msg.room.phase);
        setError("");
        setReconnecting(false);
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
        setReconnecting(false);
      } else if (msg.type === "group_state") {
        setGroup(msg.group);
        setError("");
        setReconnecting(false);
      } else if (msg.type === "left_instance") {
        setMe(null);
        setRoom(null);
        setMyRole(null);
        setWordReveal(null);
        setConnectionPhase("group");
        setError("");
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
      if (meRef.current || groupMeRef.current) setReconnecting(true);
      reconnectRef.current = setTimeout(() => {
        if (meRef.current || groupMeRef.current) connect();
      }, 3000);
    };
    ws.onerror = () => setError("No se pudo conectar al servidor");
  }, []);

  // Auto-rejoin a persisted session on mount (covers the case where the
  // mobile browser fully discarded the page while backgrounded, so the app
  // remounted from scratch instead of just dropping the socket).
  useEffect(() => {
    if (meRef.current || groupMeRef.current) connect();
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
        (meRef.current || groupMeRef.current) &&
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
    setMe(null);
    setRoom(null);
    setMyRole(null);
    setGroupMe(null);
    setGroup(null);
    setConnectionPhase("menu");
    setReconnecting(false);
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
    error,
    setError,
    reconnecting,
    connect,
    send,
    leave,
  };
}
