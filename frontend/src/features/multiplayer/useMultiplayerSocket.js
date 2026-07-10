import { useState, useRef, useCallback, useEffect } from "react";

// In dev, Vite (5173) and the backend (3001) run as separate servers, so the
// socket has to point at the backend explicitly. In production a single
// server serves the built frontend and the WS endpoint from the same origin.
const WS_URL = import.meta.env.DEV
  ? `ws://${window.location.hostname}:${import.meta.env.VITE_BACKEND_PORT || 3001}`
  : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;

// Encapsulates the WebSocket connection lifecycle (connect, reconnect/rejoin,
// message dispatch) so the UI component only deals with plain state.
export function useMultiplayerSocket() {
  const [connectionPhase, setConnectionPhase] = useState("menu"); // menu|create|join|lobby|round|voting|result
  const [me, setMe] = useState(null); // { playerId, roomCode }
  const [room, setRoom] = useState(null);
  const [myRole, setMyRole] = useState(null); // { isImpostor, word, hint }
  const [wordReveal, setWordReveal] = useState(null);
  const [error, setError] = useState("");
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const meRef = useRef(null);

  useEffect(() => { meRef.current = me; }, [me]);

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
        setConnectionPhase(phaseFor(msg.room.phase, "lobby"));
        setError("");
      } else if (msg.type === "state") {
        setRoom(msg.room);
        setConnectionPhase(prev => phaseFor(msg.room.phase, prev));
      } else if (msg.type === "private_role") {
        setMyRole(msg);
        setWordReveal(null);
      } else if (msg.type === "word_reveal") {
        setWordReveal(msg);
      } else if (msg.type === "error") {
        setError(msg.message);
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

  useEffect(() => () => {
    wsRef.current?.close();
    clearTimeout(reconnectRef.current);
  }, []);

  const send = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    else setError("Sin conexión con el servidor");
  }, []);

  return {
    connectionPhase, setConnectionPhase,
    me, room, myRole, wordReveal, error, setError,
    connect, send,
  };
}

function phaseFor(roomPhase, fallback) {
  if (roomPhase === "lobby") return "lobby";
  if (roomPhase === "round") return "round";
  if (roomPhase === "voting") return "voting";
  if (roomPhase === "result") return "result";
  return fallback;
}
