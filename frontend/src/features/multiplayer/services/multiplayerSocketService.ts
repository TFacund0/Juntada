import { WS_URL, MAX_RECONNECT_ATTEMPTS, reconnectDelayMs, WATCHDOG_CHECK_MS, PING_AFTER_IDLE_MS, WATCHDOG_DEAD_MS } from "./socketConfig";

// Minimal callback interface scoped to what useMultiplayerSocket actually
// needs — deliberately not a generic pub/sub or per-message-type callback
// set (see design decision 3). `getRejoinMessage`/`shouldReconnect` are
// getters (not values) so the service — created once via a useRef holder and
// never recreated — always reads the hook's latest me/group/room state
// without going stale (design decision 1).
export interface MultiplayerSocketServiceConfig {
  getRejoinMessage: () => Record<string, unknown> | null;
  shouldReconnect: () => boolean;
  // The WS handshake now requires a JWT (backend/src/ws/server.ts closes
  // with code 4000 "unauthorized" otherwise) — passed as the ws subprotocol
  // ["jwt.<token>"], the only browser-settable handshake header. A getter
  // (not a value) so the service — constructed once and never recreated —
  // always reads AuthContext's latest token instead of a stale closure.
  getAccessToken: () => string | null;
  onOpen?: () => void;
  onMessage: (raw: string) => void;
  onClose?: () => void;
  onError?: () => void;
  onReconnectAttempt?: (attempt: number) => void;
  onReconnectFailed?: () => void;
  // Fired on close code 4001 "session_replaced" (see design's multi-device
  // eviction policy) — a distinct case from onError/onClose since the
  // socket must NOT auto-reconnect here (see the handler below).
  onSessionReplaced?: () => void;
}

export interface MultiplayerSocketService {
  // Public API — 19 existing test call sites and MultiplayerGame.tsx depend
  // on this exact signature and short-circuit: if the socket is already
  // OPEN, `onOpen` is invoked immediately and nothing else happens.
  connect(onOpen?: (ws: WebSocket) => void): void;
  send(msg: unknown): boolean;
  isOpen(): boolean;
  isStale(): boolean;
  closeSocket(): void;
  resetReconnect(): void;
  dispose(): void;
  readonly maxReconnectAttempts: number;
}

// React-free factory owning WebSocket construction, the reconnect/backoff
// loop, and the watchdog interval (see design decision 4). Created once by
// the hook via a useRef holder — never recreated — so the watchdog and
// reconnect-attempt counter it owns internally live for the hook's whole
// lifetime, cleared only by dispose().
export function createMultiplayerSocketService(config: MultiplayerSocketServiceConfig): MultiplayerSocketService {
  const {
    getRejoinMessage,
    shouldReconnect,
    getAccessToken,
    onOpen: onOpenConfig,
    onMessage,
    onClose,
    onError,
    onReconnectAttempt,
    onReconnectFailed,
    onSessionReplaced,
  } = config;

  let ws: WebSocket | null = null;
  // Timestamp of the last message received from the server (any type,
  // including the "pong" reply to our own watchdog ping below) — read by the
  // watchdog interval to notice a half-open connection.
  let lastMessageAt = Date.now();
  // How many attempts have been made since the socket last dropped — owned
  // here (not via React setState) so scheduling doesn't depend on React
  // batching (design decision 2). The hook mirrors this into state via
  // onReconnectAttempt/onReconnectFailed for the UI.
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // Guards against dispose()'s own ws.close() re-entering onclose and
  // scheduling a fresh reconnect right after teardown.
  let disposed = false;

  function connect(explicitOnOpen?: (ws: WebSocket) => void): void {
    if (ws?.readyState === WebSocket.OPEN) {
      explicitOnOpen?.(ws);
      return;
    }
    const token = getAccessToken();
    const socket = token ? new WebSocket(WS_URL, [`jwt.${token}`]) : new WebSocket(WS_URL);
    ws = socket;
    socket.onopen = () => {
      lastMessageAt = Date.now();
      onOpenConfig?.();
      if (explicitOnOpen) explicitOnOpen(socket);
      else {
        const rejoinMessage = getRejoinMessage();
        if (rejoinMessage) socket.send(JSON.stringify(rejoinMessage));
      }
    };
    socket.onmessage = e => {
      lastMessageAt = Date.now();
      onMessage(e.data);
    };
    socket.onclose = event => {
      if (disposed) return;
      // 4001 "session_replaced" — a newer device authenticated as the same
      // account and took over the seat (see design's multi-device eviction
      // policy). This is a deliberate takeover, not a dropped connection:
      // auto-reconnecting would just immediately evict the *other* device
      // in an infinite tug-of-war, so this surfaces once via onError and
      // never retries.
      if (event.code === 4001) {
        onSessionReplaced?.();
        return;
      }
      if (!shouldReconnect()) return;
      onClose?.();
      const attempt = reconnectAttempt + 1;
      reconnectAttempt = attempt;
      if (attempt > MAX_RECONNECT_ATTEMPTS) {
        onReconnectFailed?.();
        return;
      }
      onReconnectAttempt?.(attempt);
      reconnectTimer = setTimeout(() => {
        if (shouldReconnect()) connect();
      }, reconnectDelayMs(attempt));
    };
    socket.onerror = () => onError?.();
  }

  function send(msg: unknown): boolean {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  function isOpen(): boolean {
    return ws?.readyState === WebSocket.OPEN;
  }

  function isStale(): boolean {
    return ws?.readyState === WebSocket.OPEN && Date.now() - lastMessageAt > PING_AFTER_IDLE_MS;
  }

  // Force-close: triggers the existing onclose reconnect flow (see the
  // watchdog below and the tab-visibility effect in the hook), rather than
  // reconnecting directly itself.
  function closeSocket(): void {
    ws?.close();
  }

  // Reset the attempt counter/backoff so a manual retry (after
  // MAX_RECONNECT_ATTEMPTS was exhausted) gets a fresh full run rather than
  // picking up where the exhausted loop left off.
  function resetReconnect(): void {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    reconnectAttempt = 0;
  }

  function dispose(): void {
    disposed = true;
    ws?.close();
    ws = null;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    clearInterval(watchdogId);
  }

  // See WATCHDOG_DEAD_MS: readyState alone can't tell a healthy socket from
  // a half-open one where the far end vanished without a clean close. This
  // periodically pokes the connection with our own app-level ping once it's
  // gone quiet, and force-closes it if even that gets no reply — which hands
  // off to the reconnect loop above instead of leaving the caller stuck on a
  // connection that looks open but never updates again. Started once, here,
  // for the service's whole lifetime; cleared only by dispose().
  const watchdogId = setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const idleMs = Date.now() - lastMessageAt;
    if (idleMs > WATCHDOG_DEAD_MS) ws.close();
    else if (idleMs > PING_AFTER_IDLE_MS) {
      try {
        ws.send(JSON.stringify({ type: "ping" }));
      } catch {
        /* socket not actually writable — the close above will catch it next tick */
      }
    }
  }, WATCHDOG_CHECK_MS);

  return {
    connect,
    send,
    isOpen,
    isStale,
    closeSocket,
    resetReconnect,
    dispose,
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
  };
}
