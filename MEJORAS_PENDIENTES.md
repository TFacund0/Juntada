# Mejoras pendientes

Cuestiones detectadas en una revisión de seguridad/mantenibilidad del backend. Ninguna es urgente para el tamaño actual del proyecto — quedan como radar para cuando crezca en usuarios simultáneos o en complejidad.

## ✅ Observabilidad — resuelto

Sentry integrado (`backend/src/sentry.ts`), captura excepciones no manejadas y errores de handlers WS. Notifica por mail y Discord. Opcional vía `SENTRY_DSN` — no-op si no está seteada.

## ✅ Persistencia — resuelto

Snapshot periódico a Redis (`backend/src/state/persistence.ts`): rooms/groups sobreviven a un reinicio del servidor (deploy, sleep del free tier). Opcional vía `REDIS_URL` — no-op si no está seteada. `REDIS_NAMESPACE` permite compartir una sola base de Redis entre staging y producción sin que se pisen los datos.

Probado de punta a punta en local y en un ambiente real de Render (staging): sala creada → redeploy forzado → sala recuperada intacta.

**Limitación conocida (aceptada, no un bug)**: las conexiones WebSocket activas igual se cortan en el reinicio — los jugadores reconectan solos vía `rejoin`/`rejoin_group` (ya mejorado con backoff, contador de intentos y botón de reintento manual). Hay una ventana chica de pérdida entre el último snapshot (~20s) y un crash abrupto no gracioso — mitigado guardando también en `SIGTERM`.

## Testing

Los tests actuales (157 backend, 125 frontend) cubren la lógica de juego (`roomService`, engines) y el hook de reconexión del frontend, pero no la capa WS del backend en sí (`server.ts`, rate limiting, chequeo de Origin, snapshot/restore). Se probó todo eso a mano de punta a punta, pero no hay tests automatizados. Si esta capa se vuelve a tocar seguido, conviene un test de integración liviano que abra un socket real contra el server.

## Escalado horizontal — sigue pendiente, deliberadamente fuera de alcance

Con estado en memoria no se puede correr más de una instancia del backend (los sockets de un jugador deben estar en el mismo proceso que su sala). El snapshot a Redis resuelve la persistencia entre reinicios, pero **no** convierte a Redis en la fuente de verdad en vivo — para eso habría que reescribir el flujo de lectura/escritura de todos los handlers y motores de juego a async, un cambio grande con riesgo real de bugs de condición de carrera (se evaluó y se descartó a propósito, ver conversación de implementación de Redis).

Mientras se use una sola instancia (que es el caso hoy) está bien; si algún día hace falta escalar por carga real, esto se vuelve un bloqueante.

## Otros temas mencionados, sin implementar

- **Dominio propio** (ej. `juntada.com` vía Cloudflare) — puramente cosmético, no afecta rendimiento. Costo aproximado: 10-15 USD/año.
- **Plan pago de Render** — mejora rendimiento real (no se duerme, más RAM/CPU). Costo aproximado: 7-25 USD/mes según el tier. Independiente de comprar un dominio.
- **Docker** — no resuelve ningún problema funcional hoy (Render ya buildea el proyecto Node sin él), pero es una inversión de aprendizaje/portabilidad válida si en algún momento interesa como ejercicio.
