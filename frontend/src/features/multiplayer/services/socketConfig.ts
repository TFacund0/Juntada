// In dev, Vite (5173) and the backend (3001) run as separate servers, so the
// socket has to point at the backend explicitly. In production a single
// server serves the built frontend and the WS endpoint from the same origin.
export const WS_URL = import.meta.env.DEV
  ? `ws://${window.location.hostname}:${import.meta.env.VITE_BACKEND_PORT || 3001}`
  : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;

// Stops the automatic retry loop after this many failed attempts so a
// truly-gone connection doesn't retry silently forever — the UI offers a
// manual "reintentar"/"volver al menú" choice once this is hit instead.
export const MAX_RECONNECT_ATTEMPTS = 10;
// Backoff between retries: starts at 3s, grows by 600ms per attempt, caps
// at 8s — gentler on a flaky connection (and the server) than hammering
// every 3s indefinitely, while still recovering quickly from a brief drop.
export function reconnectDelayMs(attempt: number): number {
  return Math.min(3000 + (attempt - 1) * 600, 8000);
}

// The backend already pings every 30s and terminates sockets that don't
// pong back (see backend/src/ws/server.ts's HEARTBEAT_INTERVAL_MS) — but
// that's a protocol-level ping/pong the browser answers automatically
// without ever surfacing it to this hook's onmessage. So when the far end
// vanishes without a clean TCP close (phone loses signal mid-session, wifi
// drops instantly), the client's readyState keeps reporting OPEN forever:
// no onclose ever fires, so the reconnect loop below never kicks in and the
// player is stuck until they manually reload. This app-level watchdog is
// what actually notices — see the setInterval near the bottom of the hook.
export const WATCHDOG_CHECK_MS = 10_000;
// Send our own {type:"ping"} once the server's gone quiet this long — well
// past a normal lull between broadcasts, short enough to catch a dead
// connection quickly.
export const PING_AFTER_IDLE_MS = 15_000;
// No message at all (not even our own ping's "pong" reply) for this long
// means the socket is lying about being OPEN — force-close it so the
// existing onclose reconnect flow takes over.
export const WATCHDOG_DEAD_MS = 35_000;

// How long to wait, after a group_joined/group_state during a group-attached
// cold start, for the "joined" that only arrives if the persisted instance
// is still live — see settleGroupColdStart in useMultiplayerSocket.
export const GROUP_JOINED_FALLBACK_MS = 1_500;
