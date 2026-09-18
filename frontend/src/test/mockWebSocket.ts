// jsdom (Vitest's default DOM environment) doesn't implement WebSocket, and
// useMultiplayerSocket talks to a real one — this stands in for it in tests.
// Install with `vi.stubGlobal("WebSocket", MockWebSocket)` in a test/beforeEach,
// then drive it via `MockWebSocket.instances` (every socket ever constructed,
// newest last) instead of touching the hook's internals.

export class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  static instances: MockWebSocket[] = [];

  url: string;
  // The WS handshake now needs the JWT subprotocol (see
  // features/multiplayer/services/multiplayerSocketService.ts) — recorded
  // here so tests can assert `new WebSocket(url, ["jwt.<token>"])` happened.
  protocols: string[];
  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols ? (Array.isArray(protocols) ? protocols : [protocols]) : [];
    MockWebSocket.instances.push(this);
  }

  // Tests call this to simulate the server accepting the connection —
  // nothing opens on its own, matching how a real handshake is async.
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateClose(code = 1000): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code });
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: 1000 });
  }

  static reset(): void {
    MockWebSocket.instances = [];
  }
}
