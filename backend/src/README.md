# Backend

Arranque del servidor + la infraestructura sobre la que corre el motor
online de cada juego. Las reglas de cada juego viven en `games/<juego>/`
(cada una implementando el contrato `GameEngine` en `games/engineTypes.ts`)
— este README cubre todo lo que está _alrededor_ de eso.

## Arranque (leer en este orden para entender cómo arranca el proceso)

- **`env.ts`** — valida cada variable de entorno una sola vez al arrancar el
  proceso, para que una mal tipeada o faltante falle ruidosamente acá en vez
  de comportarse mal en silencio después.
- **`sentry.ts`** — reporte de errores, no hace nada hasta que se setea
  `SENTRY_DSN`. Debe ser el primer import en `server.ts` para que su
  instrumentación se enganche antes de que cargue cualquier otra cosa.
- **`app.ts`** — compone la app de Express, el servidor HTTP y el servidor
  de WebSocket. Separado del punto de entrada real `server.ts` (no está en
  esta carpeta — ver la raíz del repo) para que los tests puedan importarlo
  sin abrir un puerto.
- **`logger.ts`** — logging estructurado (Pino): con formato lindo en
  desarrollo, JSON plano en producción (lo que espera Render/la mayoría de
  los recolectores de logs).

## Capas en tiempo de ejecución

- **`ws/`** — el protocolo de WebSocket: manejo de conexión, validación,
  rate limiting, despacho de mensajes, broadcast. Ver `ws/README.md`.
- **`rooms/`** — ciclo de vida genérico de sala/grupo (crear, unirse,
  reconectar, limpieza) — sin reglas de ningún juego. Ver `rooms/README.md`.
- **`state/`** — la fuente de verdad en memoria (`roomStore.ts`) más el
  snapshot periódico para sobrevivir a un reinicio del proceso
  (`persistence.ts`).
- **`http/`** — las rutas HTTP planas (health check, servir el frontend ya
  buildeado) al lado del endpoint de WebSocket.
- **`games/`** — `engineTypes.ts` (el contrato `GameEngine`) y
  `registry.ts` (el motor de cada juego, buscado por `gameType`) en el
  nivel superior; las reglas reales de cada juego en `games/<juego>/`.

## Si necesitás cambiar algo

- ¿El servidor no arranca / manejo de variables de entorno? → `env.ts` /
  `app.ts`.
- ¿El comportamiento de un tipo de mensaje? → `ws/README.md`.
- ¿Ciclo de vida de sala/grupo (no las reglas de un juego puntual)? →
  `rooms/README.md`.
- ¿Qué sobrevive a un reinicio, o la forma de los datos en memoria? →
  `state/`.
- ¿Las reglas de un juego específico? → la carpeta propia de ese juego en
  `games/<juego>/`, no acá.
