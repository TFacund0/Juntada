import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MockWebSocket } from "../../../test/mockWebSocket";
import { createMultiplayerSocketService, type MultiplayerSocketServiceConfig } from "./multiplayerSocketService";

function makeConfig(overrides: Partial<MultiplayerSocketServiceConfig> = {}): MultiplayerSocketServiceConfig {
  return {
    getRejoinMessage: () => null,
    shouldReconnect: () => true,
    getAccessToken: () => null,
    onMessage: () => {},
    ...overrides,
  };
}

describe("multiplayerSocketService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
    MockWebSocket.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("connect() dedupes when the socket is already OPEN — invokes onOpen immediately and opens no new socket", () => {
    const service = createMultiplayerSocketService(makeConfig());
    service.connect();
    MockWebSocket.instances[0].simulateOpen();
    expect(MockWebSocket.instances).toHaveLength(1);

    const onOpen = vi.fn();
    service.connect(onOpen);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(MockWebSocket.instances[0]);
    expect(MockWebSocket.instances).toHaveLength(1);
    service.dispose();
  });

  it("sends the default rejoin message from getRejoinMessage() on open when no explicit onOpen is given", () => {
    const getRejoinMessage = vi.fn(() => ({ type: "rejoin", roomCode: "ABCD", playerId: "p1" }));
    const service = createMultiplayerSocketService(makeConfig({ getRejoinMessage }));
    service.connect();
    MockWebSocket.instances[0].simulateOpen();
    expect(MockWebSocket.instances[0].sent).toEqual([JSON.stringify({ type: "rejoin", roomCode: "ABCD", playerId: "p1" })]);
    service.dispose();
  });

  it("sends nothing on open when getRejoinMessage() returns null and no explicit onOpen is given", () => {
    const service = createMultiplayerSocketService(makeConfig());
    service.connect();
    MockWebSocket.instances[0].simulateOpen();
    expect(MockWebSocket.instances[0].sent).toEqual([]);
    service.dispose();
  });

  it("follows the backoff schedule (3000ms, +600ms per attempt, capped at 8000ms) between reconnect attempts", () => {
    const onReconnectAttempt = vi.fn();
    const service = createMultiplayerSocketService(makeConfig({ onReconnectAttempt }));
    service.connect();
    MockWebSocket.instances[0].simulateClose();
    expect(onReconnectAttempt).toHaveBeenCalledWith(1);

    vi.advanceTimersByTime(2999);
    expect(MockWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(2);

    MockWebSocket.instances[1].simulateClose();
    expect(onReconnectAttempt).toHaveBeenCalledWith(2);
    vi.advanceTimersByTime(3599);
    expect(MockWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(3);
    service.dispose();
  });

  it("stops retrying and calls onReconnectFailed once MAX_RECONNECT_ATTEMPTS is exceeded", () => {
    const onReconnectFailed = vi.fn();
    const service = createMultiplayerSocketService(makeConfig({ onReconnectFailed }));
    service.connect();
    // MAX_RECONNECT_ATTEMPTS is 10: attempts 1-10 each schedule a retry,
    // the 11th close pushes the counter past the cap.
    for (let i = 0; i < 11; i++) {
      const instance = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      instance.simulateClose();
      if (i < 10) vi.runOnlyPendingTimers();
    }
    expect(onReconnectFailed).toHaveBeenCalledTimes(1);
    const countBefore = MockWebSocket.instances.length;
    vi.advanceTimersByTime(60_000);
    expect(MockWebSocket.instances.length).toBe(countBefore);
    service.dispose();
  });

  it("shouldReconnect() === false suppresses the retry loop entirely", () => {
    const shouldReconnect = vi.fn(() => false);
    const onReconnectAttempt = vi.fn();
    const service = createMultiplayerSocketService(makeConfig({ shouldReconnect, onReconnectAttempt }));
    service.connect();
    MockWebSocket.instances[0].simulateClose();
    expect(onReconnectAttempt).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(MockWebSocket.instances).toHaveLength(1);
    service.dispose();
  });

  it("watchdog pings after idle, then force-closes a truly dead connection", () => {
    const service = createMultiplayerSocketService(makeConfig());
    service.connect();
    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.sent = [];

    vi.advanceTimersByTime(20_000);
    expect(ws.sent).toEqual([JSON.stringify({ type: "ping" })]);

    vi.advanceTimersByTime(20_000);
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    service.dispose();
  });

  it("watchdog does not ping/close a socket that is receiving messages", () => {
    const service = createMultiplayerSocketService(makeConfig());
    service.connect();
    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.sent = [];

    vi.advanceTimersByTime(10_000);
    ws.simulateMessage({ type: "state" });
    vi.advanceTimersByTime(10_000);
    expect(ws.sent).toEqual([]);
    expect(ws.readyState).toBe(MockWebSocket.OPEN);
    service.dispose();
  });

  it("dispose() clears the watchdog interval and any pending reconnect timer", () => {
    const onReconnectAttempt = vi.fn();
    const service = createMultiplayerSocketService(makeConfig({ onReconnectAttempt }));
    service.connect();
    MockWebSocket.instances[0].simulateClose();
    expect(onReconnectAttempt).toHaveBeenCalledTimes(1);

    service.dispose();
    onReconnectAttempt.mockClear();
    vi.advanceTimersByTime(60_000);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(onReconnectAttempt).not.toHaveBeenCalled();
  });

  it("isOpen() reflects the underlying socket readyState", () => {
    const service = createMultiplayerSocketService(makeConfig());
    expect(service.isOpen()).toBe(false);
    service.connect();
    expect(service.isOpen()).toBe(false);
    MockWebSocket.instances[0].simulateOpen();
    expect(service.isOpen()).toBe(true);
    service.dispose();
  });

  it("send() returns false and doesn't throw when not OPEN, true when it writes", () => {
    const service = createMultiplayerSocketService(makeConfig());
    expect(service.send({ type: "ping" })).toBe(false);
    service.connect();
    MockWebSocket.instances[0].simulateOpen();
    expect(service.send({ type: "ping" })).toBe(true);
    expect(MockWebSocket.instances[0].sent).toContain(JSON.stringify({ type: "ping" }));
    service.dispose();
  });

  it("closeSocket() force-closes and hands off to the reconnect flow via onclose", () => {
    const onReconnectAttempt = vi.fn();
    const service = createMultiplayerSocketService(makeConfig({ onReconnectAttempt }));
    service.connect();
    MockWebSocket.instances[0].simulateOpen();
    service.closeSocket();
    expect(onReconnectAttempt).toHaveBeenCalledWith(1);
    service.dispose();
  });

  it("resetReconnect() clears a pending scheduled attempt and resets the counter", () => {
    const onReconnectAttempt = vi.fn();
    const service = createMultiplayerSocketService(makeConfig({ onReconnectAttempt }));
    service.connect();
    MockWebSocket.instances[0].simulateClose();
    expect(onReconnectAttempt).toHaveBeenCalledWith(1);

    service.resetReconnect();
    vi.advanceTimersByTime(60_000);
    expect(MockWebSocket.instances).toHaveLength(1);

    service.connect();
    MockWebSocket.instances[1].simulateClose();
    expect(onReconnectAttempt).toHaveBeenCalledWith(1);
    service.dispose();
  });

  it("maxReconnectAttempts is exposed and matches the configured cap", () => {
    const service = createMultiplayerSocketService(makeConfig());
    expect(service.maxReconnectAttempts).toBe(10);
    service.dispose();
  });

  it('opens the WebSocket with the ["jwt.<token>"] subprotocol when getAccessToken() returns a token', () => {
    const service = createMultiplayerSocketService(makeConfig({ getAccessToken: () => "abc123" }));
    service.connect();
    expect(MockWebSocket.instances[0].protocols).toEqual(["jwt.abc123"]);
    service.dispose();
  });

  it("opens the WebSocket with no subprotocol when getAccessToken() returns null", () => {
    const service = createMultiplayerSocketService(makeConfig({ getAccessToken: () => null }));
    service.connect();
    expect(MockWebSocket.instances[0].protocols).toEqual([]);
    service.dispose();
  });

  it("close code 4001 (session_replaced) calls onSessionReplaced and does NOT schedule a reconnect", () => {
    const onSessionReplaced = vi.fn();
    const onReconnectAttempt = vi.fn();
    const service = createMultiplayerSocketService(makeConfig({ onSessionReplaced, onReconnectAttempt }));
    service.connect();
    MockWebSocket.instances[0].simulateClose(4001);
    expect(onSessionReplaced).toHaveBeenCalledTimes(1);
    expect(onReconnectAttempt).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(MockWebSocket.instances).toHaveLength(1);
    service.dispose();
  });

  it("imports nothing from react", async () => {
    const [fs, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
    const filePath = path.join(__dirname, "multiplayerSocketService.ts");
    const src = await fs.readFile(filePath, "utf-8");
    expect(src).not.toMatch(/from\s+["']react["']/);
  });
});
