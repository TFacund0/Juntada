# API de WebSocket

Referencia de todos los mensajes que cruzan el límite cliente/servidor. La
fuente de verdad es `packages/shared-types/index.ts` — este documento es una
vista legible de eso, mantenida en sincronía a mano. Si los dos no
coinciden, ganan los tipos (y los esquemas zod que los respaldan).

- Los mensajes cliente→servidor se validan contra `SCHEMAS` en
  `packages/shared-types/index.ts` antes de llegar a cualquier handler
  (`backend/src/ws/validation.ts`). Un mensaje que no pasa la validación
  recibe un `VALIDATION_ERROR` y se ignora.
- Los mensajes servidor→cliente están tipados como `ServerMessage`. Todos son
  objetos JSON planos con un campo `type`.
- Una conexión de WebSocket = un jugador. No hay un paso separado de
  handshake o autenticación — `create_room`/`join_room`/`rejoin` (o sus
  equivalentes de grupo) son lo que establece la identidad.

## Conexión

- Dev: `ws://<host>:<VITE_BACKEND_PORT || 3001>` (frontend y backend corren
  como servidores separados).
- Producción: mismo origen que la página, `wss://` sobre HTTPS.

El servidor hace ping a cada conexión cada 30s y termina cualquier socket que
no responde, así una conexión muerta (celular sin batería, wifi cortado sin
un cierre prolijo) se limpia sin depender de un mensaje del cliente.

## Cliente → Servidor

### Salas y grupos

Lifecycle genérico, manejado igual sin importar qué juego se esté jugando.
Una sala (`Room`) es una partida puntual de un solo juego; un grupo
(`Group`) es un lobby persistente bajo el cual se pueden abrir varias salas
("instancias") — ver [Salas y grupos](./README.md#salas-y-grupos) en el
README para el panorama general.

| Tipo              | Payload                                 | Notas                                                                                                                 |
| ------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `create_room`      | `{ playerName?, roomName?, gameType? }`  | `gameType` por defecto es `"impostor"`. Quien lo envía queda como host.                                                  |
| `join_room`        | `{ code, playerName? }`                  | Solo permitido mientras la sala está en `"lobby"`.                                                                       |
| `rejoin`           | `{ roomCode, playerId }`                 | Recupera un lugar tras una conexión caída, dentro del período de gracia.                                                 |
| `create_group`     | `{ playerName?, groupName? }`            | Crea un grupo nuevo. Quien lo envía queda como host del grupo y primer miembro.                                          |
| `join_group`       | `{ code, playerName? }`                  | Se une a un grupo existente por su código.                                                                               |
| `rejoin_group`     | `{ groupCode, playerId }`                | Recupera membresía de grupo tras una conexión caída; si tenía una instancia abierta, también se reintegra a ella.        |
| `create_instance`  | `{ gameType }`                           | Abre una sala nueva bajo el grupo actual. Cualquier miembro puede hacerlo, no solo el host del grupo.                    |
| `join_instance`    | `{ roomCode }`                           | Se une a una instancia ya abierta del grupo. Si ya estaba en otra, sale de esa primero.                                  |
| `leave_instance`   | `{}`                                     | Sale de la instancia actual y vuelve a la pantalla del grupo, sin abandonar el grupo en sí.                              |
| `leave_group`      | `{}`                                     | Sale del grupo por completo (y de la instancia actual, si tenía una abierta).                                           |
| `update_config`    | `{ config }`                             | Solo el host. `config` se valida como datos planos acotados (strings/números/booleans, ≤50 claves) — su forma real es específica de cada juego. |
| `start_round`      | `{}`                                     | Solo el host.                                                                                                            |
| `back_to_lobby`    | `{}`                                     | Solo el host.                                                                                                            |
| `kick_player`      | `{ targetId }`                           | Solo el host.                                                                                                            |
| `transfer_host`    | `{ targetId }`                           | Solo el host actual. Funciona tanto dentro de una sala/instancia como en la pantalla de grupo (sin instancia abierta).   |
| `ping`             | `{}`                                     | Responde con `pong`; no hace falta para el heartbeat (ver arriba), disponible para chequeos de latencia del lado cliente. |

### Acciones dentro de la ronda

Se despachan de forma genérica al motor que sea dueño del `gameType` de la
sala (`backend/src/games/*/engine.ts`) vía `handleAction`. Mandar una que la
fase actual no acepta devuelve `INVALID_ACTION`, no un crash:

| Tipo                   | Payload                                                 | Usado por                |
| ----------------------- | -------------------------------------------------------- | -------------------------- |
| `submit_clue`           | `{ clue? }`                                              | El Impostor                |
| `player_ready`          | `{}`                                                     | El Impostor, Tutifrutti     |
| `vote`                  | `{ suspectId }`                                          | El Impostor                |
| `skip_word`             | `{}`                                                     | El Impostor                |
| `continue_round`        | `{}`                                                     | El Impostor                |
| `submit_guess`          | `{ value }` (0–100)                                      | Sintonía                    |
| `confirm_round_setup`   | `{ psychicId?, spectrumMode?, left?, right? }`           | Sintonía                    |
| `submit_spectrum`       | `{ mode, left?, right? }`                                | Sintonía                    |
| `new_game`              | `{}`                                                     | Sintonía                    |
| `mark`                  | `{ index }` (0–8)                                        | Ta-Te-Ti                    |
| `reset_score_vote`      | `{}`                                                     | Ta-Te-Ti                    |
| `report_result`         | `{ roundIdx, matchIdx, goalsA?, goalsB?, winnerSide? }`  | Torneo FIFA (solo el host)  |
| `reveal`                | `{}`                                                     | Limón Limón                 |
| `assign`                | `{ targetId }`                                           | Limón Limón                 |
| `vote_end`              | `{}`                                                     | Limón Limón                 |
| `confirm_letter`        | `{ reroll? }`                                            | Tutifrutti (solo el host)   |
| `submit_answers`        | `{ answers }` (id de categoría → palabra, ≤50 entradas)  | Tutifrutti                  |
| `call_basta`            | `{}`                                                     | Tutifrutti                  |
| `mark_word`             | `{ targetPlayerId, categoryId, valid }`                  | Tutifrutti                  |
| `confirm_review`        | `{}`                                                     | Tutifrutti                  |
| `spin`                  | `{}`                                                     | Ruleta (solo el host)       |
| `confirm_eliminate`     | `{}`                                                     | Ruleta (solo el host, modo eliminación) |
| `spin_again`            | `{}`                                                     | Ruleta (solo el host, modo repetir)     |

## Servidor → Cliente

| Tipo            | Payload                          | Se manda cuando                                                                                                                                                                       |
| ---------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `joined`         | `{ playerId, roomCode, room }`     | `create_room`/`join_room`/`rejoin` tiene éxito — solo a ese cliente.                                                                                                                   |
| `state`          | `{ room }`                         | Cada vez que cambia el estado de la sala — broadcast a todos los que están en ella. `room` es la vista pública (`RoomPublicState`): sin información oculta por jugador.               |
| `group_joined`   | `{ playerId, groupCode, group }`   | `create_group`/`join_group`/`rejoin_group` tiene éxito — solo a ese cliente.                                                                                                           |
| `group_state`    | `{ group }`                        | Cada vez que cambia el estado del grupo (miembros, instancias abiertas) — broadcast a todos los miembros.                                                                             |
| `left_instance`  | `{}`                               | Confirmación de que `leave_instance` se procesó — el cliente vuelve a la pantalla de grupo.                                                                                            |
| `left_group`     | `{}`                               | Confirmación de que `leave_group` se procesó — el cliente vuelve al menú principal.                                                                                                    |
| `private_role`   | `{ ...específico del motor }`      | Información oculta por jugador para la ronda activa (por ejemplo la palabra/rol de El Impostor, el objetivo de Sintonía). Se manda solo al jugador correspondiente.                    |
| `word_reveal`    | `{ ...específico del motor }`      | Se dispara cuando una ronda se resuelve, junto con el siguiente `state`, para que la revelación no se pierda si un `state` posterior reemplaza `room.round`. La forma difiere según el motor — ver `getRevealMessage` de cada `engine.ts`. |
| `kicked`         | `{}`                               | Se manda a un jugador justo antes de ser removido de una sala.                                                                                                                          |
| `pong`           | `{}`                               | Respuesta a un `ping` del cliente.                                                                                                                                                       |
| `error`          | `{ code, message }`                | Ver abajo.                                                                                                                                                                               |

### Errores

Todo error que manda el servidor tiene la misma forma: un `code` estable
para reaccionar programáticamente, y un `message` en español pensado para
mostrarse al jugador tal cual. Construido en un solo lugar, `sendError()` en
`backend/src/ws/messaging.ts`.

| Código                   | Significado                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `VALIDATION_ERROR`        | El mensaje no coincidió con su esquema (forma inválida, campo faltante, tipo incorrecto).                                              |
| `RATE_LIMITED`             | Demasiados intentos de `create_room`/`join_room` desde esta IP dentro de la ventana.                                                    |
| `CREATE_ROOM_FAILED`       | `gameType` desconocido, o el servidor llegó a su límite de salas.                                                                       |
| `JOIN_ROOM_FAILED`         | El código de sala no existe, la sala no está en `lobby`, la sala está llena, o el nombre ya está en uso.                                |
| `REJOIN_FAILED`            | La sala ya no existe, o ese `playerId` no forma parte de ella (venció el período de gracia o el jugador fue expulsado).                 |
| `CREATE_GROUP_FAILED`      | El servidor llegó a su límite de grupos activos.                                                                                        |
| `JOIN_GROUP_FAILED`        | El código de grupo no existe, el grupo está lleno, o el nombre ya está en uso en ese grupo.                                             |
| `REJOIN_GROUP_FAILED`      | El grupo ya no existe, o ese `playerId` no forma parte de él (venció el período de gracia).                                             |
| `CREATE_INSTANCE_FAILED`   | `gameType` desconocido, o ya hay demasiadas instancias abiertas en el grupo.                                                            |
| `JOIN_INSTANCE_FAILED`     | La instancia no existe, no está en `lobby`, está llena, o el nombre ya está en uso en ella.                                             |
| `LEAVE_GROUP_FAILED`       | No se pudo procesar la salida del grupo (por ejemplo, el remitente ya no forma parte de él).                                            |
| `NOT_ENOUGH_PLAYERS`       | El host intentó arrancar una ronda por debajo del `minPlayers` del juego.                                                               |
| `START_ROUND_FAILED`       | El motor rechazó `startRound` por una razón específica del juego (por ejemplo, sin categorías activas, equipos sin asignar).            |
| `INVALID_ACTION`           | Una acción dentro de la ronda fue rechazada para la fase/estado actual — la más común, esperable durante el juego normal (por ejemplo, votar dos veces, actuar fuera de turno). |
| `INTERNAL_ERROR`           | Un handler o motor tiró una excepción. Se loguea del lado del servidor con el error completo; el cliente solo recibe un mensaje genérico. |

## Reconexión

El lugar de un jugador desconectado se conserva (marcado `online: false`, no
se elimina) durante 5 minutos, tiempo durante el cual `rejoin`/`rejoin_group`
lo restaura. Pasada esa ventana, la sala o el grupo se elimina si todos
siguen offline; si alguien se reconecta a tiempo, el efecto del timer se
cancela. Ver `roomService.ts`'s `markOffline`/`scheduleRoomCleanup` y su
equivalente en `groupService.ts` para grupos.
