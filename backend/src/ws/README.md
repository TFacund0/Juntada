# Capa WebSocket

Todo lo referido al protocolo de comunicación: aceptar conexiones, validar/
limitar los mensajes entrantes, despacharlos, y mandar el estado de vuelta.
Ninguna regla de juego vive acá — eso es el motor propio de cada juego
(`src/games/<juego>/`), buscado vía `src/games/registry.ts`.

## Leer en este orden

1. **`server.ts`** — el transporte en sí: conecta los eventos open/message/
   close de un socket `ws` crudo con los handlers de abajo. No conoce la
   forma de una sala/grupo ni de ningún tipo de mensaje.
2. **`validation.ts`** — un mensaje crudo es input no confiable (puede venir
   de cualquier cosa que hable el protocolo, no solo del frontend de esta
   app). Valida contra los `SCHEMAS` de zod en `@juntada/shared-types` —
   los mismos schemas de los que se deriva el tipo `ClientMessage`, así que
   el validador y el tipo nunca pueden desincronizarse.
3. **`rateLimiter.ts`** — un limitador chico de ventana fija (con clave
   `"ip:tipoDeMensaje"`) para que un script bombardeando `create_room`/
   `join_room` no pueda agotar memoria o fuerza-bruta-ar códigos de sala.
4. **`handlers.ts`** — la única tabla de despacho para cada tipo de mensaje,
   más los handlers que son genuinamente transversales entre una sala y su
   grupo (`transferHost`, `handleDisconnect`).
5. **`roomHandlers.ts`** — handlers exclusivos de sala standalone (crear/
   unirse/config/expulsar/acciones dentro de la ronda).
6. **`groupHandlers.ts`** — handlers anclados a un grupo (crear/unirse a un
   grupo, abrir/unirse/salir de una instancia debajo de él).
7. **`shared.ts`** — helpers que necesitan tanto `roomHandlers.ts` como
   `groupHandlers.ts` (timers de fase, broadcast, el período de gracia de
   reacción a desconexión, `PLAYER_OFFLINE_TIMEOUT_MS`) — separado para que
   ningún módulo de handlers tenga que importar del otro.
8. **`messaging.ts`** — los primitivos reales de `send`/`broadcast`, y los
   constructores de vista pública/privada (qué puede o no ver un cliente).

## Si necesitás cambiar algo

- ¿Un tipo de mensaje nuevo? → agregá su schema en `@juntada/shared-types`,
  después un handler en `roomHandlers.ts` o `groupHandlers.ts` (o en
  `handlers.ts` si genuinamente abarca sala y grupo a la vez), y por último
  registralo en la tabla de despacho de `handlers.ts`.
- ¿Algo del timing de reconexión/desconexión? → `shared.ts`.
- ¿Qué ve un cliente en un broadcast? → `messaging.ts`.
