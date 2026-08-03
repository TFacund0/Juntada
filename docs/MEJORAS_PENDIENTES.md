# Mejoras pendientes

Cuestiones detectadas en una revisión de seguridad/mantenibilidad del backend. Ninguna es urgente para el tamaño actual del proyecto — quedan como radar para cuando crezca en usuarios simultáneos o en complejidad.

Reorganización de juegos (motor/hooks/CSS por juego, siguiendo el criterio de Recámara) tiene su propio documento aparte: `docs/REORGANIZACION_JUEGOS.md`.

## ✅ Observabilidad — resuelto

Sentry integrado (`backend/src/sentry.ts`), captura excepciones no manejadas y errores de handlers WS. Notifica por mail y Discord. Opcional vía `SENTRY_DSN` — no-op si no está seteada.

## ✅ Persistencia — resuelto

Snapshot periódico a Redis (`backend/src/state/persistence.ts`): rooms/groups sobreviven a un reinicio del servidor (deploy, sleep del free tier). Opcional vía `REDIS_URL` — no-op si no está seteada. `REDIS_NAMESPACE` permite compartir una sola base de Redis entre staging y producción sin que se pisen los datos.

Probado de punta a punta en local y en un ambiente real de Render (staging): sala creada → redeploy forzado → sala recuperada intacta.

**Limitación conocida (aceptada, no un bug)**: las conexiones WebSocket activas igual se cortan en el reinicio — los jugadores reconectan solos vía `rejoin`/`rejoin_group` (ya mejorado con backoff, contador de intentos y botón de reintento manual). Hay una ventana chica de pérdida entre el último snapshot (~20s) y un crash abrupto no gracioso — mitigado guardando también en `SIGTERM`.

## ✅ Testing — resuelto (actualizado)

312 tests backend, 284 tests frontend, más suite E2E con Playwright (`e2e/`, raíz del monorepo) cubriendo flujos reales de punta a punta: navegación por URL, dos jugadores reales uniéndose al mismo grupo, y el regression test del botón "atrás" del navegador en medio de una partida. CI corre todo (lint, typecheck, tests, build, E2E) en cada push/PR, con el reporte de Playwright subido como artifact si algo falla.

## Escalado horizontal — sigue pendiente, deliberadamente fuera de alcance

Con estado en memoria no se puede correr más de una instancia del backend (los sockets de un jugador deben estar en el mismo proceso que su sala). El snapshot a Redis resuelve la persistencia entre reinicios, pero **no** convierte a Redis en la fuente de verdad en vivo — para eso habría que reescribir el flujo de lectura/escritura de todos los handlers y motores de juego a async, un cambio grande con riesgo real de bugs de condición de carrera (se evaluó y se descartó a propósito, ver conversación de implementación de Redis).

Mientras se use una sola instancia (que es el caso hoy) está bien; si algún día hace falta escalar por carga real, esto se vuelve un bloqueante.

## Rate limiting HTTP en memoria — limitación conocida, aceptada

`backend/src/app.ts` usa `express-rate-limit` con el store por defecto (en memoria del proceso). Funciona bien con una sola instancia (el caso hoy), pero si algún día se escala a más de una instancia detrás de un load balancer, cada una lleva su propio conteo — un atacante podría esquivar el límite repartiendo pedidos entre instancias. Solución cuando haga falta: un store compartido (Redis, ya soportado opcionalmente en el proyecto) en vez de memoria.

## Content-Security-Policy — deliberadamente no configurada

`helmet` está activo (`backend/src/app.ts`) con `contentSecurityPolicy: false` a propósito: la CSP por defecto bloquea el atributo `style="..."` sin `'unsafe-inline'`, y este proyecto usa `style={{...}}` inline en React por todos lados — activarla tal cual rompería visualmente toda la app. Armar una CSP real es su propio trabajo (nonces para `<script>`, decidir qué hacer con `style-src`), no algo para colar de paso. Si en algún momento se migra el styling a Tailwind (className en vez de atributos `style` inline), ese problema desaparece solo como efecto secundario — pero no es motivo suficiente por sí solo para justificar esa migración.

## Imágenes de juegos — evaluar un servicio externo (Cloudinary o similar)

Hoy solo Impostor tiene imágenes propias, bundleadas en el repo (`games/impostor/assets/`, ~64KB en total). A medida que se le vayan agregando imágenes juego por juego (28 juegos en total), conviene evaluar un servicio como Cloudinary o Cloudflare Images en vez de seguir bundleando binarios en git: CDN + optimización automática de formato/calidad, sin cargar ese peso en el build ni en el backend de Render (plan free). Trade-off: dependencia externa — si el servicio tiene un downtime o se llega al límite del tier gratuito, esas imágenes puntuales fallan (a diferencia de un asset bundleado). Conviene arrancar este patrón pronto, antes de que sea una migración de 28 juegos a la vez.

## Cuentas de usuario, stats y grupos de amigos — plan a futuro, requiere una base de datos real

Hoy no hay usuarios ni datos persistentes por jugador — todo el estado (salas, grupos) es efímero en memoria con Redis solo como snapshot de recuperación (TTL 24hs, sin schema). El día que se implemente registro de usuarios, historial de victorias por juego y grupos de amigos persistentes, **no** conviene estirar el mecanismo de Redis actual para esto (está diseñado para estado efímero de partidas en curso, no para registros permanentes).

Recomendación para cuando llegue ese momento:

- **Postgres** para todo lo relacional/persistente (usuarios, victorias, membresías de grupo) — Render tiene Postgres administrado, o **Supabase** (Postgres + autenticación lista de fábrica).
- Redis sigue haciendo exactamente lo que hace hoy (snapshot de salas en vivo) — son dos trabajos distintos, no se mezclan.
- Auth: evitar programar un sistema de contraseñas propio desde cero (fuente típica de bugs de seguridad en proyectos chicos) — usar Supabase Auth, Clerk, o login sin contraseña (magic link) en su lugar.
- Los datos estáticos de juego (palabras, categorías — `packages/*-data`) siguen como están, versionados en código: no son candidatos a mover a esta base de datos, son configuración de contenido, no datos de usuario.

Este es un proyecto propio, no una mejora incremental — planificarlo aparte cuando se decida encarar.

## Otros temas mencionados, sin implementar

- **Dominio propio** (ej. `juntada.com` vía Cloudflare) — puramente cosmético, no afecta rendimiento. Costo aproximado: 10-15 USD/año.
- **Plan pago de Render** — mejora rendimiento real (no se duerme, más RAM/CPU). Costo aproximado: 7-25 USD/mes según el tier. Independiente de comprar un dominio.
- **Docker** — no resuelve ningún problema funcional hoy (Render ya buildea el proyecto Node sin él), pero es una inversión de aprendizaje/portabilidad válida si en algún momento interesa como ejercicio.
