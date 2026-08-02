# Rooms

Ciclo de vida genérico de salas y grupos — crear, unirse, reconectar,
manejo de desconexiones, limpieza. Nada acá conoce las reglas de ningún
juego; eso es el motor propio de cada juego (`src/games/<juego>/`). Esta
capa nunca debería necesitar cambiar para agregar un juego nuevo.

- **`roomService.ts`** — una sala (una instancia de un juego): crear/unirse/
  reconectar, acciones exclusivas del host (expulsar, patch de config),
  manejo de desconexión/reconexión, limpieza una vez que está totalmente
  offline pasado el período de gracia.
- **`groupService.ts`** — un grupo (el lobby persistente al que una sala
  puede pertenecer opcionalmente): crear/unirse/reconectar, membresía, el
  mismo tipo de manejo de desconexión/limpieza que una sala.
- **`roomCode.ts`** — genera los códigos de 5 caracteres que usan tanto
  salas como grupos (comparten el mismo espacio de códigos, así un código
  siempre significa sin ambigüedad una cosa o la otra, nunca ambas).
- **`constants.ts`** — constantes de timing (`ONLINE_CLEANUP_DELAY_MS`) que
  ambos servicios necesitan de forma idéntica — está acá en vez de que un
  servicio importe del otro, ya que ninguno debería depender de los
  internals del otro.
- **`rosterUtils.ts`** — `Room.players` y `Group.members` son
  estructuralmente idénticos para dos chequeos (si ese nombre ya está en
  uso, quién pasa a ser host) — compartido acá en vez de que cada servicio
  reimplemente la misma regla contra su propio tipo.

## Si necesitás cambiar algo

- ¿Comportamiento específico de sala (crear/unirse a una instancia de
  juego)? → `roomService.ts`.
- ¿Comportamiento específico de grupo (crear/unirse a un grupo, membresía)?
  → `groupService.ts`.
- ¿Una regla que es idéntica para ambos (nombre en uso, traspaso de host,
  una constante de timing compartida)? → `rosterUtils.ts` / `constants.ts`,
  no duplicada en los dos servicios.
