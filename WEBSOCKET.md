# WebSocket API

Reference for every message that crosses the client/server boundary. The
source of truth is `packages/shared-types/index.ts` — this document is a
human-readable view of it, kept in sync manually. If the two disagree, the
types (and the zod schemas backing them) win.

- Client→server messages are validated against `SCHEMAS` in
  `packages/shared-types/index.ts` before they ever reach a handler
  (`backend/src/ws/validation.ts`). A message that fails validation gets a
  `VALIDATION_ERROR` back and is otherwise ignored.
- Server→client messages are typed as `ServerMessage`. All of them are plain
  JSON objects with a `type` field.
- One websocket connection = one player. There is no separate handshake or
  auth step — `create_room`/`join_room`/`rejoin` are what establish identity.

## Connecting

- Dev: `ws://<host>:<VITE_BACKEND_PORT || 3001>` (frontend and backend run as
  separate servers).
- Production: same origin as the page, `wss://` on HTTPS.

The server pings every connection every 30s and terminates any socket that
doesn't respond, so a dead connection (phone died, wifi dropped without a
clean close) gets cleaned up without waiting on a message from the client.

## Client → Server

Generic room lifecycle, handled the same way regardless of which game is
being played:

| Type            | Payload                                 | Notes                                                                                                                            |
| --------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `create_room`   | `{ playerName?, roomName?, gameType? }` | `gameType` defaults to `"impostor"`. Sender becomes host.                                                                        |
| `join_room`     | `{ code, playerName? }`                 | Only allowed while the room is in `"lobby"`.                                                                                     |
| `rejoin`        | `{ roomCode, playerId }`                | Reclaims a slot after a dropped connection, within the grace period.                                                             |
| `update_config` | `{ config }`                            | Host-only. `config` is validated as bounded plain data (strings/numbers/booleans, ≤50 keys) — its actual shape is game-specific. |
| `start_round`   | `{}`                                    | Host-only.                                                                                                                       |
| `back_to_lobby` | `{}`                                    | Host-only.                                                                                                                       |
| `kick_player`   | `{ targetId }`                          | Host-only.                                                                                                                       |
| `ping`          | `{}`                                    | Replied to with `pong`; not required for the heartbeat (see above), available for client-side latency checks.                    |

In-round actions, dispatched generically to whichever engine owns the room's
`gameType` (`backend/src/games/*/engine.ts`) via `handleAction`. Sending one
that the current phase doesn't accept gets `INVALID_ACTION` back, not a
crash:

| Type                  | Payload                                                 | Used by                 |
| --------------------- | ------------------------------------------------------- | ----------------------- |
| `submit_clue`         | `{ clue? }`                                             | Impostor                |
| `player_ready`        | `{}`                                                    | Impostor, Tutifrutti    |
| `vote`                | `{ suspectId }`                                         | Impostor                |
| `skip_word`           | `{}`                                                    | Impostor                |
| `submit_guess`        | `{ value }` (0–100)                                     | Sintonía                |
| `confirm_round_setup` | `{ psychicId?, spectrumMode?, left?, right? }`          | Sintonía                |
| `mark`                | `{ index }` (0–8)                                       | Ta-Te-Ti                |
| `reset_score_vote`    | `{}`                                                    | Ta-Te-Ti                |
| `report_result`       | `{ roundIdx, matchIdx, goalsA?, goalsB?, winnerSide? }` | Torneo FIFA (host-only) |
| `reveal`              | `{}`                                                    | Limón Limón             |
| `assign`              | `{ targetId }`                                          | Limón Limón             |
| `vote_end`            | `{}`                                                    | Limón Limón             |
| `confirm_letter`      | `{ reroll? }`                                           | Tutifrutti (host-only)  |
| `submit_answers`      | `{ answers }` (category id → word, ≤50 entries)         | Tutifrutti              |
| `call_basta`          | `{}`                                                    | Tutifrutti              |
| `mark_word`           | `{ targetPlayerId, categoryId, valid }`                 | Tutifrutti              |
| `confirm_review`      | `{}`                                                    | Tutifrutti              |

## Server → Client

| Type           | Payload                        | Sent when                                                                                                                                                                                         |
| -------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `joined`       | `{ playerId, roomCode, room }` | `create_room`/`join_room`/`rejoin` succeeds — to that client only.                                                                                                                                |
| `state`        | `{ room }`                     | Any time room state changes — broadcast to everyone in the room. `room` is the public view (`RoomPublicState`): no hidden per-player info.                                                        |
| `private_role` | `{ ...engine-specific }`       | Per-player hidden info for the active round (e.g. Impostor's word/role, Sintonía's target). Sent only to the relevant player.                                                                     |
| `word_reveal`  | `{ ...engine-specific }`       | Fired once a round resolves, alongside the next `state`, so the reveal isn't lost if a later `state` replaces `room.round`. Shape differs per engine — see each `engine.ts`'s `getRevealMessage`. |
| `kicked`       | `{}`                           | Sent to a player right before they're removed from a room.                                                                                                                                        |
| `pong`         | `{}`                           | Reply to a client `ping`.                                                                                                                                                                         |
| `error`        | `{ code, message }`            | See below.                                                                                                                                                                                        |

### Errors

Every error the server sends has the same shape: a stable `code` to branch
on programmatically, and a `message` in Spanish meant to be shown to the
player as-is. Constructed in exactly one place, `sendError()` in
`backend/src/ws/messaging.ts`.

| Code                 | Meaning                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VALIDATION_ERROR`   | The message didn't match its schema (bad shape, missing field, wrong type).                                                                             |
| `RATE_LIMITED`       | Too many `create_room`/`join_room` attempts from this IP within the window.                                                                             |
| `CREATE_ROOM_FAILED` | Unknown `gameType`, or the server is at its room cap.                                                                                                   |
| `JOIN_ROOM_FAILED`   | Room code doesn't exist, room isn't in `lobby`, room is full, or the name is taken.                                                                     |
| `REJOIN_FAILED`      | Room no longer exists, or this `playerId` isn't part of it (grace period expired or player was kicked).                                                 |
| `NOT_ENOUGH_PLAYERS` | Host tried to start a round below the game's `minPlayers`.                                                                                              |
| `START_ROUND_FAILED` | The engine rejected `startRound` for a game-specific reason (e.g. no active categories, teams not assigned).                                            |
| `INVALID_ACTION`     | An in-round action was rejected for the current phase/state — the most common one, expected during normal play (e.g. voting twice, acting out of turn). |
| `INTERNAL_ERROR`     | A handler or engine threw. Logged server-side with the full error; the client only gets a generic message.                                              |

## Reconnection

A disconnected player's slot is kept (marked `online: false`, not removed)
for 5 minutes, during which `rejoin` restores it. Past that window the room
is deleted if every player is still offline; if anyone reconnects in time,
the timer's effect is cancelled. See `roomService.ts`'s
`markOffline`/`scheduleRoomCleanup`.
