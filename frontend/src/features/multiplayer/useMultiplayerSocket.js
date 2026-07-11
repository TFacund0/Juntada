import { useState, useRef, useCallback, useEffect } from "react";

// In dev, Vite (5173) and the backend (3001) run as separate servers, so the
// socket has to point at the backend explicitly. In production a single
// server serves the built frontend and the WS endpoint from the same origin.
const WS_URL = import.meta.env.DEV
  ? `ws://${window.location.hostname}:${import.meta.env.VITE_BACKEND_PORT || 3001}`
  : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;

// Backgrounding the tab on mobile (switching to WhatsApp, locking the screen,
// etc.) can kill the socket or even discard the JS context entirely. We
// persist just enough identity to rejoin the same room after either case —
// the server already keeps a disconnected player's slot reserved (marked
// offline, not removed) for a grace period, so this is what lets the client
// actually make use of that instead of dumping the player back at the menu.
const SESSION_KEY = "impostorgame:session";

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* storage unavailable (private mode, etc.) — degrade silently */ }
}

// Exposed so the root app can drop a persisted session when the player
// deliberately navigates away (back to menu, picks a different game), rather
// than leaving it around to be wrongly auto-rejoined on a later visit.
export function clearMultiplayerSession() { saveSession(null); }

// Encapsulates the WebSocket connection lifecycle (connect, reconnect/rejoin,
// message dispatch) so the UI component only deals with plain state.
export function useMultiplayerSocket() {
  // menu|create|join, then mirrors room.phase directly ("lobby" and whatever
  // in-game phases the active game defines — this hook doesn't know or care
  // what those are).
  const [connectionPhase, setConnectionPhase] = useState("menu");
  const [me, setMe] = useState(() => loadSession()); // { playerId, roomCode }
  const [room, setRoom] = useState(null);
  const [myRole, setMyRole] = useState(null); // { isImpostor, word, hint }
  const [wordReveal, setWordReveal] = useState(null);
  const [error, setError] = useState("");
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const meRef = useRef(me);
  const roomRef = useRef(null);

  useEffect(() => { meRef.current = me; saveSession(me); }, [me]);
  useEffect(() => { roomRef.current = room; }, [room]);

  const connect = useCallback((onOpen) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) { onOpen?.(wsRef.current); return; }
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => {
      if (onOpen) onOpen(ws);
      else if (meRef.current) ws.send(JSON.stringify({ type: "rejoin", roomCode: meRef.current.roomCode, playerId: meRef.current.playerId }));
    };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === "joined") {
        setMe({ playerId: msg.playerId, roomCode: msg.roomCode });
        setRoom(msg.room);
        setConnectionPhase(msg.room.phase);
        setError("");
      } else if (msg.type === "state") {
        setRoom(msg.room);
        setConnectionPhase(msg.room.phase);
        setError("");
      } else if (msg.type === "private_role") {
        setMyRole(msg);
        setWordReveal(null);
      } else if (msg.type === "word_reveal") {
        setWordReveal(msg);
      } else if (msg.type === "error") {
        setError(msg.message);
        // Failed before ever landing in a room — either a fresh join with a
        // bad code, or a restored/rejoin session whose room has since
        // expired. Either way, never leave the UI stuck: drop the stale
        // session and send them back to the menu instead of an infinite
        // "Conectando..." with nothing to rejoin.
        if (!roomRef.current) {
          setMe(null);
          setRoom(null);
          setConnectionPhase(prev => (prev === "menu" || prev === "create" || prev === "join" ? prev : "join"));
        }
      } else if (msg.type === "kicked") {
        setConnectionPhase("menu");
        setMe(null); setRoom(null); setMyRole(null);
        setError("Fuiste expulsado de la sala");
      }
    };
    ws.onclose = () => {
      reconnectRef.current = setTimeout(() => {
        if (meRef.current) connect();
      }, 3000);
    };
    ws.onerror = () => setError("No se pudo conectar al servidor");
  }, []);

  // Auto-rejoin a persisted session on mount (covers the case where the
  // mobile browser fully discarded the page while backgrounded, so the app
  // remounted from scratch instead of just dropping the socket).
  useEffect(() => {
    if (meRef.current) connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timers/sockets get throttled or suspended while a mobile tab is in the
  // background. Rather than waiting for the passive onclose+3s retry (which
  // may be delayed well past when the user actually comes back), proactively
  // check the connection the moment the tab becomes visible again.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && meRef.current && wsRef.current?.readyState !== WebSocket.OPEN) {
        clearTimeout(reconnectRef.current);
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

  useEffect(() => () => {
    wsRef.current?.close();
    clearTimeout(reconnectRef.current);
  }, []);

  const send = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    else setError("Sin conexión con el servidor");
  }, []);

  // Explicit leave (kicked, "Menú principal", etc.) should forget the
  // session so a later fresh visit doesn't try to rejoin a room the player
  // deliberately left.
  const leave = useCallback(() => {
    wsRef.current?.close();
    clearTimeout(reconnectRef.current);
    setMe(null);
    setRoom(null);
    setMyRole(null);
    setConnectionPhase("menu");
  }, []);

  return {
    connectionPhase, setConnectionPhase,
    me, room, myRole, wordReveal, error, setError,
    connect, send, leave,
  };
}
