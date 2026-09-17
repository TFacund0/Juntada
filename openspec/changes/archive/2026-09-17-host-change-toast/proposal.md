# Proposal: Host reassignment toast notification (Item 3)

## Intent

When the host of a room leaves, is kicked, or the host role is transferred, `room.hostId` changes. The backend broadcasts the updated `RoomPublicState` to all clients, but currently clients receive this silently without any user-facing feedback. Players don't realize the host changed (or that they themselves became host) until they notice the crown icon or disabled/enabled buttons.

This proposal adds a status toast notification whenever `room.hostId` changes in an active room, following the existing pattern of `usePlayerPresenceToasts` and `useRoomEventToasts`.

## Scope

- Domain: `multiplayer-toast`
- Affected files:
  - `frontend/src/features/multiplayer/hooks/useRoomEventToasts.ts`
  - `frontend/src/features/multiplayer/hooks/__tests__/useRoomEventToasts.test.ts`
  - Optionally `useMultiplayerGameShell.ts` if `myPlayerId` is needed for personalized messaging ("Ahora sos el anfitrión").

## Approach

1. Include `hostId` in `RoomSnapshot` within `useRoomEventToasts`.
2. When `prev.code === room.code` and `prev.hostId !== room.hostId`:
   - Identify the new host from `room.players`.
   - If `newHost.id === myPlayerId`: emit `"Ahora sos el anfitrión"`.
   - Otherwise: emit `"${newHost.name} es el nuevo anfitrión"`.
3. Pass `myPlayerId` into `useRoomEventToasts` from `useMultiplayerGameShell` (which already receives `me?.playerId`).
4. Unit tests covering:
   - Host transfer to another player.
   - Host transfer to self ("Ahora sos el anfitrión").
   - Ignored when room code changes or on initial room mount.
