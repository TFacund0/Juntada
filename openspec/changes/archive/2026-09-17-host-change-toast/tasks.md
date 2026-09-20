# Tasks: Host Reassignment Toast Notification

Change: `sdd/host-change-toast`

## Task List

- [x] **T1: Implement unit tests in `useRoomEventToasts.test.ts`**
  - Add tests for host change to another player (`"${name} es el nuevo anfitrión"`).
  - Add test for host change to current player (`"Ahora sos el anfitrión"` when matching `myPlayerId`).
  - Add test for fallback when name cannot be resolved.
  - Verify existing tests continue to pass.

- [x] **T2: Update `useRoomEventToasts.ts`**
  - Add `myPlayerId?: string` to `UseRoomEventToastsArgs`.
  - Add `hostId: string` to `RoomSnapshot`.
  - Add diff logic for `prev.hostId !== room.hostId` with personalized toast text.

- [x] **T3: Wire `myPlayerId` in `useMultiplayerGameShell.ts`**
  - Pass `myPlayerId: me?.playerId` to `useRoomEventToasts`.

- [x] **T4: Verification**
  - Run `vitest run src/features/multiplayer/hooks/__tests__/useRoomEventToasts.test.ts`.
  - Run typecheck and linting on frontend (`pnpm --filter frontend typecheck`).
