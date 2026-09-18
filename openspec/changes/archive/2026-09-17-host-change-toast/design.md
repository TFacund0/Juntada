# Technical Design: Host Reassignment Toast Notification

Change: `sdd/host-change-toast`
Domain: `multiplayer-toast`

## Architectural Context

In Juntada, room events without dedicated server messages are detected client-side by diffing `RoomPublicState` snapshots in React hooks (`usePlayerPresenceToasts`, `useRoomEventToasts`).
`useRoomEventToasts` currently monitors:

1. `prev.phase !== "lobby" && room.phase === "lobby"` -> `"Volvieron al lobby"`.
2. Member leaving an instance in a group room -> `"${leftPlayerName} volvió al grupo"`.

Host reassignment happens on the backend either:

- Automatically via `reassignHostIfNeeded` (e.g. host disconnects/kicked/removed).
- Explicitly via `transfer_host` message.

In both cases, `room.hostId` updates and is broadcast in `RoomPublicState`.

## Detailed Changes

### 1. `useRoomEventToasts.ts`

- Extend `UseRoomEventToastsArgs`:
  ```ts
  interface UseRoomEventToastsArgs {
    room: RoomPublicState | null;
    myPlayerId?: string;
    setStatusToast: (message: string | null) => void;
    setLobbyTab: (tab: "players" | "config") => void;
  }
  ```
- Extend `RoomSnapshot`:
  ```ts
  interface RoomSnapshot {
    code: string;
    phase: string;
    hostId: string;
    players: Record<string, string>;
  }
  ```
- In `useEffect`:
  ```ts
  if (prev && prev.code === room.code) {
    if (prev.hostId !== room.hostId) {
      const newHostName = room.players.find(p => p.id === room.hostId)?.name;
      if (room.hostId === myPlayerId) {
        setStatusToast("Ahora sos el anfitrión");
      } else if (newHostName) {
        setStatusToast(`${newHostName} es el nuevo anfitrión`);
      } else {
        setStatusToast("Cambió el anfitrión");
      }
    }
    // ... rest of existing checks ...
  }
  ```

### 2. `useMultiplayerGameShell.ts`

- Pass `myPlayerId: me?.playerId` to `useRoomEventToasts`:
  ```ts
  useRoomEventToasts({ room, myPlayerId: me?.playerId, setStatusToast, setLobbyTab });
  ```

### 3. Unit Tests (`useRoomEventToasts.test.ts`)

- Add tests covering:
  - Host change to third-party player: emits `"${name} es el nuevo anfitrión"`.
  - Host change to self (`myPlayerId` match): emits `"Ahora sos el anfitrión"`.
  - Host change with unknown player name fallback: emits `"Cambió el anfitrión"`.
  - Same host across renders: no toast emitted.
  - Different room code: no toast emitted.
