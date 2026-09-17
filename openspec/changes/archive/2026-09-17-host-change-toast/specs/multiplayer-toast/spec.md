# Delta Spec: Host Reassignment Toast Notification

Change: `sdd/host-change-toast`
Domain: `multiplayer-toast`

## Requirements

### R1: Detect host change within same room

`useRoomEventToasts` MUST track `room.hostId` across renders. When `prev.code === room.code` and `prev.hostId !== room.hostId`, it MUST emit a status toast describing the change.

### R2: Personalized host assignment message

- If the new host's ID matches `myPlayerId`, the toast message MUST be `"Ahora sos el anfitrión"`.
- If the new host's ID does NOT match `myPlayerId`, the toast message MUST be `"${newHostName} es el nuevo anfitrión"`.
- If the new host cannot be found in `room.players`, it MUST fall back to `"Cambió el anfitrión"`.

### R3: No false positives on initial render or room transition

- On initial mount or when `room` is first received, no host toast MUST be emitted.
- When switching rooms (different `room.code`), no host toast MUST be emitted.

## Scenarios

### Scenario 1: Reassignment to another player

- GIVEN player A is host in room "ABCDE"
- WHEN player A leaves and player B ("Beto") becomes host
- THEN `useRoomEventToasts` calls `setStatusToast("Beto es el nuevo anfitrión")`.

### Scenario 2: Reassignment to current player

- GIVEN player A is host in room "ABCDE" and current player is player B ("Beto", `myPlayerId = "p2"`)
- WHEN player A leaves and player B becomes host (`room.hostId = "p2"`)
- THEN `useRoomEventToasts` calls `setStatusToast("Ahora sos el anfitrión")`.

### Scenario 3: Room code transition

- GIVEN room "AAAAA" with host "p1"
- WHEN room state updates to room "BBBBB" with host "p2"
- THEN `useRoomEventToasts` does NOT emit any host toast.
