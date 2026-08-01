# Analytics y métricas de uso

Ideas para implementar cuando el juego esté más maduro, con el objetivo de saber cuánta gente usa Juntada, cuántos se registran y cómo interactúan con los juegos.

## 1. Analytics de producto (tráfico, comportamiento)

Herramientas para saber cuánta gente entra a la página, desde dónde, qué páginas visitan y qué eventos custom dispara (crear sala, invitar jugadores, iniciar partida, etc).

### Opción A: Plausible / Umami

- **Qué son**: analytics livianos, sin cookies, orientados a privacidad (no necesitan banner de consentimiento en la mayoría de los casos).
- **Umami** se puede self-hostear gratis (Docker + Postgres/MySQL); **Plausible** también es self-hosteable o se paga como cloud.
- **Dan**: pageviews, visitantes únicos, referrers, dispositivos, países, y eventos custom básicos.
- **Ideal si**: solo te importa "cuánta gente entra y desde dónde", sin necesidad de funnels complejos.
- **Implementación**: agregar un script `<script>` en el `index.html` del frontend. Sin backend propio necesario (salvo que self-hostees Umami).

### Opción B: PostHog

- **Qué es**: plataforma de product analytics más completa (eventos custom, funnels, session replay, feature flags).
- **Tiene** free tier generoso y también se puede self-hostear.
- **Dan**: todo lo de arriba + funnels ("cuántos que entraron llegaron a crear una sala"), retención, cohortes, grabación de sesiones para ver dónde se traban los usuarios.
- **Ideal si**: además de tráfico querés entender el flujo real de uso (ej. cuánta gente abandona antes de empezar una partida).
- **Implementación**: SDK de JS en el frontend (`posthog-js`), llamando a `posthog.capture('evento', {props})` en los puntos clave (registro, crear sala, unirse a sala, iniciar juego, etc).

**Recomendación**: si el objetivo es simple (saber cuánta gente usa la app), arrancar con Umami/Plausible. Si en el futuro se quiere optimizar el funnel de conversión (cuántos entran vs. cuántos juegan), migrar o sumar PostHog.

## 2. Métricas propias desde la base de datos

Cosas que **no** necesitan herramienta externa porque ya viven en el backend/DB del proyecto:

- Cantidad de usuarios registrados por día/semana/mes (`COUNT` con filtro de fecha de creación).
- Usuarios activos (ej. que crearon o se unieron a una sala en los últimos X días).
- Cantidad de salas/partidas creadas, y cuántas llegan a completarse.
- Juegos más jugados (agrupando por tipo de juego).
- Tamaño promedio de grupo/sala.

Esto se puede exponer como:

- Un endpoint interno protegido (ej. `/admin/stats`) que devuelva estos números.
- O directamente queries SQL manuales cuando se necesite revisar algo puntual.

No hace falta construir un dashboard elaborado al principio; alcanza con un endpoint simple o incluso queries a mano contra la DB de producción.

## 3. Orden sugerido de implementación (a futuro)

1. Analytics de producto liviano (Umami o Plausible) — bajo esfuerzo, da visión general de tráfico ya.
2. Eventos custom clave (registro, crear sala, iniciar partida) para entender el funnel.
3. Si hace falta más profundidad (funnels, replays), migrar a PostHog.
4. Endpoint interno de stats desde la DB para métricas de negocio (usuarios, salas, retención) que no dependen de terceros.

## Notas

- Ninguna de estas opciones requiere gran esfuerzo de implementación (scripts de un tag o SDK de JS), por lo que se puede sumar en paralelo a otras mejoras sin bloquear el roadmap de juegos.
- Si se apunta a usuarios de la UE o se quiere evitar temas legales de cookies, priorizar Umami/Plausible/PostHog self-hosted por sobre Google Analytics.
