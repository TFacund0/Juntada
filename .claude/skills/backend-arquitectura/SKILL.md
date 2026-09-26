---
name: backend-arquitectura
description: Principios de arquitectura, separación de responsabilidades, DRY y seguridad que backend/src debe respetar al construir código nuevo, más 9 gaps concretos de deuda técnica ya auditados (mensajes de error sin catálogo, magic strings de fase, duplicación roomHandlers/groupHandlers, constantes desincronizadas, snapshots sin backfill, engines inconsistentes, try/catch faltante). Usar SIEMPRE que se toque un archivo de backend/src/ (nuevo o existente) — tanto para construir algo nuevo como para corregir algo ya escrito de paso, incluso si el pedido no menciona "arquitectura" o "buenas prácticas" explícitamente.
---

# Arquitectura y deuda técnica del backend — Juntada

Esta skill tiene dos partes: **cómo construir código nuevo** en `backend/src` (principios,
no una lista de bugs) y **9 gaps concretos ya auditados** en el código existente (números
reales, corrección gradual atada a lo que se toca — mismo criterio que
`frontend-deuda-tecnica`).

No es una migración de arquitectura de una sola vez. Es la referencia que aplicás cada vez
que tocás `backend/src`, para que el sistema converja de a poco hacia un mismo estilo en vez
de acumular una forma distinta de resolver lo mismo en cada módulo nuevo.

## Parte 1 — Principios para construir código nuevo

### 1.1 Capas + patrón adaptador: solo en los bordes con infraestructura real

`backend/src/auth/` ya implementa el patrón de referencia de este repo: `http/` (rutas) →
`service/` (lógica de negocio, depende solo de interfaces) → `repository/`/`mail/`
(adaptadores concretos: Drizzle, Resend) → `ports.ts` (las interfaces que separan una capa de
otra) → `index.ts` (composition root que inyecta los adaptadores reales). Ver
`auth/ports.ts`/`auth/index.ts` como ejemplo vivo.

**Aplicá este mismo patrón cuando un módulo nuevo hable con infraestructura externa
intercambiable** (una base de datos, un servicio de terceros, un storage) donde tenga sentido
testear contra un fake sin tocar la infra real.

**No lo apliques** a módulos que solo manejan estado en memoria del proceso, como `rooms/` y
`ws/` hoy (`Map`s en `state/roomStore.ts`). Ahí no hay infraestructura externa que
intercambiar — meter una interfaz `RoomRepository` con un único adaptador "en memoria" es
indirección sin beneficio, exactamente lo que ya prohíbe `.claude/skills/CLAUDE.md`
("no crear abstracciones especulativas"). El patrón que SÍ corresponde ahí ya está aplicado:
`games/engineTypes.ts` (interfaz `GameEngine`) + `games/registry.js` (selecciona la
implementación concreta por `gameType`) es un adaptador/strategy real — cada `engine.ts` es
una implementación intercambiable del mismo puerto. Un juego nuevo se suma implementando esa
interfaz, no inventando su propia forma de conectar con `roomService`.

Este es el patrón estándar de la industria para juegos de salas en tiempo real (Jackbox,
Codenames, Among Us y similares): estado autoritativo en memoria del proceso servidor, capas
livianas solo en los bordes reales (auth, persistencia, mail, pagos). No hace falta DDD pesado
dentro del loop de juego — sí en los bordes con infraestructura swappeable.

**Techo conocido de esta arquitectura** (no acción hoy, sí algo a tener en cuenta si el
proyecto escala a más de una instancia del servidor): el estado de una sala vive en la RAM de
UN proceso. Correr más de una instancia del backend detrás de un balanceador rompe esto salvo
que se agregue afinidad de sesión (el balanceador siempre manda el código de una sala a la
misma instancia) o se externalice el estado de sala a algo compartido entre instancias (Redis,
que ya se usa para los snapshots de `state/persistence.ts`, escalaría bien vía pub/sub). Si
alguna vez se plantea correr más de una instancia, es right momento de resolver esto — no
antes.

### 1.2 Separación infra/negocio

Ya documentado en `.claude/skills/CLAUDE.md`: `http/`, `ws/`, `state/` son infraestructura;
`games/<id>/`, `rooms/`, `auth/service/` son negocio. Reforzando con ejemplos concretos de
este repo:

- Un handler de `ws/roomHandlers.ts` o `ws/groupHandlers.ts` nunca decide una regla de juego
  (quién puede votar, cuándo termina una ronda) — delega siempre al `engine` correspondiente
  (`getEngine(room.gameType)`). Si estás por escribir un `if` que depende del tipo de juego
  dentro de un handler de `ws/`, esa lógica va al engine, no ahí.
- `rooms/roomService.ts` conoce las reglas genéricas de sala (cupos, host, kick, reconexión) —
  nunca reglas específicas de un juego puntual.
- `auth/http/authRoutes.ts` solo traduce HTTP ↔ `authService` (status codes, parseo de
  request/response) — la lógica de negocio (¿el username está tomado?, ¿la contraseña es
  válida?) vive en `auth/service/authService.ts`.

### 1.3 DRY aplicado a patrones específicos de este backend

Más allá de la regla general de `.claude/skills/CLAUDE.md`, en este backend duplicar suele
aparecer en tres formas puntuales — evitalas desde el código nuevo:

- **Mensajes de error como literales repetidos**: antes de escribir `return { error: "..." }`
  o `sendError(ws, code, "...")` con un texto nuevo, buscá (grep) si ya existe un mensaje
  parecido en el repo. No agregues una tercera redacción de la misma idea.
- **Timers/constantes de tiempo duplicadas**: si dos módulos necesitan el mismo valor de
  timeout/expiración (ej. algo relacionado a cookies y a los tokens que esas cookies
  protegen), que sea una sola constante importada por ambos, no dos cálculos independientes
  que puedan desincronizarse en silencio.
- **Magic strings de fase de sala** (`"lobby"`, `"round"`, `"result"`, etc.): si agregás una
  comparación nueva contra una fase, evaluá si conviene una constante compartida en vez de un
  literal más — hoy `phase` es `string` suelto en `shared-types`, así que un typo en un
  literal no falla en compilación.

### 1.4 Seguridad — lo que ya está bien resuelto (seguir el mismo patrón, no reinventar)

Este backend ya tiene una postura de seguridad razonable — al agregar código nuevo, seguí
estos mismos patrones en vez de inventar uno propio:

- **Rate limiting de dos niveles**: un piso general en `app.ts` (`httpRateLimiter`, 300
  req/min) más límites específicos por tipo de acción sensible (`auth/http/authRoutes.ts`'s
  `authRateLimiter`, `ws/rateLimiter.ts`'s `RATE_LIMITS` por tipo de mensaje WS). Un endpoint
  HTTP o mensaje WS nuevo que sea sensible (crea recursos, cuesta CPU, es un vector de abuso)
  necesita su propio límite explícito, no solo apoyarse en el piso general.
- **Validación de input con zod en el borde**: los mensajes WS se validan contra schemas de
  `shared-types` en `ws/validation.ts` antes de llegar a cualquier handler — los handlers
  reciben `msg` ya validado, nunca confían en el tipo de TypeScript a secas en runtime. Un
  mensaje WS nuevo sigue este mismo patrón. Los endpoints HTTP de `auth/` validan el body de
  forma equivalente — seguí ese ejemplo para un endpoint HTTP nuevo.
- **Secretos nunca en texto plano**: el refresh token y el token de reset de contraseña se
  persisten como hash (SHA-256), nunca el valor crudo (ver `auth/ports.ts`'s comentario en
  `createRefreshToken`). Cualquier token/secreto nuevo que necesite persistirse sigue el mismo
  criterio — hashealo antes de guardarlo, el valor crudo solo existe en tránsito hacia el
  cliente.
- **Passwords**: hasheadas vía `auth/service/passwordHasher.ts`, nunca comparadas ni logueadas
  en texto plano.
- **CORS explícito**: `app.ts` fija `origin` desde `env.CORS_ORIGIN` en producción (permisivo
  solo en dev, donde front y back corren en puertos distintos) — no agregues un wildcard `*`
  nuevo en ningún handler.
- **Errores sin filtrar detalles internos al cliente**: los `ErrorCode` tipados + mensajes
  humanos curados son lo que cruza la red — nunca un stack trace o un error crudo de
  Drizzle/Redis. Sentry (`sentry.ts`) es donde va el detalle interno, no la respuesta al
  cliente.
- **CSP deshabilitado a propósito** (`app.ts`, comentario en `helmet({ contentSecurityPolicy:
false })`): es una decisión consciente y documentada, no un descuido — no la "arregles" sin
  abordar el motivo real (estilos inline del frontend) como su propio trabajo dedicado.

### 1.5 Tests

Todo módulo de negocio nuevo (`rooms/`, `games/*/engine.ts`, `auth/service/`,
`auth/repository/`) lleva su test desde el commit que lo crea, no después — mismo criterio que
ya exige `.claude/skills/CLAUDE.md` para cambios de comportamiento en general, reforzado acá
porque la lógica de negocio de este backend es la más barata de testear (sin Express, sin
sockets reales — ver los tests actuales de `rooms/roomService.ts` como referencia).

## Parte 2 — 9 gaps de deuda técnica ya auditados (código existente)

Auditoría de 2026-09-18. Corrección gradual: si tu cambio ya toca uno de estos archivos,
corregilo ahí mismo — no vayas a buscar violaciones en archivos que no ibas a tocar igual.

### 2.1 Mensajes de error sin catálogo central

67 ocurrencias en 15+ archivos, en tres estilos distintos: `return { error: "..." }` en
`games/*/engine.ts` + `rooms/*.ts` (41), `sendError(ws, code, mensaje)` en `ws/roomHandlers.ts`
/ `ws/groupHandlers.ts` / `ws/server.ts` (17), `res.status().json({error})` en
`auth/http/authRoutes.ts` (9, snake_case, un tercer estilo más). `ErrorCode` ya está tipado en
`packages/shared-types` para el código, pero el texto humano no tiene ninguna fuente única.

Duplicados textuales reales ya encontrados: "Se necesitan al menos..." vs "Necesitás al
menos..." (mismo caso, 8 archivos, dos frases distintas para lo mismo); "No hay categorías
activas" repetido literal en 4 engines; `"El servidor está lleno..."` duplicado exacto en
`rooms/groupService.ts:40` y `rooms/roomService.ts:47,88`; `"Estás yendo muy rápido..."`
repetido 3 veces en el mismo archivo `ws/server.ts:225,235,239`.

- Si tu cambio ya toca un engine o handler con uno de estos mensajes, extraelo a un objeto
  compartido (ej. en `games/engineTypes.ts` para mensajes de engine) en vez de dejarlo como
  literal nuevo.
- Consolidá primero los duplicados **exactos** (bajo riesgo, no cambian comportamiento) cuando
  aparezcan en tu diff; los casi-duplicados con redacción distinta solo si el archivo ya está
  en tu cambio.

### 2.2 Cobertura de tests faltante en módulos de negocio/infra

5 archivos sin test propio: `state/persistence.ts` (167 líneas, snapshot/restore a Redis —
afecta el estado post-deploy), `ws/messaging.ts` (172 líneas), `ws/groupHandlers.ts` (271
líneas — solo `create_group` cubierto tangencialmente en `wsServer.test.ts:112-151`;
`joinInstance`/`leaveInstance`/`kickMember`/`rejoinGroup` sin test), `ws/rateLimiter.ts` (37
líneas), `rooms/rosterUtils.ts` (24 líneas).

- Si tu cambio toca lógica en alguno de estos archivos, agregá el test que cubra ese cambio en
  el mismo commit.
- Prioridad si tenés que elegir dónde invertir tiempo no pedido explícitamente:
  `persistence.ts` primero (bug ahí = estado corrupto post-deploy), `groupHandlers.ts` segundo.

### 2.3 Fases de sala como magic strings

25 ocurrencias del literal `"lobby"` en 12 archivos; `phase` está tipado como `string` suelto
en `packages/shared-types/index.ts` (Room, RoomPublicState), no como unión/enum. Ejemplo:
`ws/roomHandlers.ts` compara el mismo literal 3 veces en el archivo (líneas 138, 151, 215).

- Si tu cambio agrega una comparación nueva contra una fase, preferí una constante compartida
  — si no existe todavía, proponé agregar un `ROOM_PHASE` (const object, no enum de TS) a
  `shared-types` como parte de ese mismo cambio.
- No migres de golpe las 25 ocurrencias existentes.

### 2.4 Duplicación puntual roomHandlers.ts / groupHandlers.ts

No son "casi calcados" función por función — operan sobre entidades de dominio distintas (sala
standalone vs. instancia de grupo). La duplicación real y barata de extraer es el esqueleto de
auto-kick: `schedulePlayerKick` (`roomHandlers.ts:277-299`) vs `scheduleGroupMemberKick`
(`groupHandlers.ts:244-257`) — mismo patrón exacto de `setTimeout` + chequeo de `online` +
kick + broadcast.

- Si tocás cualquiera de esas dos funciones, evaluá extraer el esqueleto común a `ws/shared.ts`
  (que ya centraliza timers compartidos como `scheduleOfflineReaction`).
- No fuerces una fusión más amplia de create/join/rejoin entre room y group.

### 2.5 Constantes de timeout/edad calculadas en dos lugares

`REFRESH_COOKIE_MAX_AGE_MS` (`auth/http/authRoutes.ts:57`) y `REFRESH_TOKEN_TTL_MS`
(`auth/service/tokenService.ts:19`) calculan el **mismo valor** de forma independiente en dos
archivos — cambiar uno sin el otro los desincroniza en silencio.

- Si tocás cualquiera de esos dos valores, unificalos en una sola constante importada por
  ambos archivos en ese mismo cambio.
- No crees un `constants.ts` global para todos los `*_MS` del proyecto — el resto vive cerca
  de donde se usa (ej. `PLAYER_OFFLINE_TIMEOUT_MS` en `ws/shared.ts`) y no está en riesgo real.

### 2.6 Snapshots (`state/persistence.ts`) sin backfill genérico de schema

Solo loguea un warning si `SCHEMA_VERSION` no coincide; no hay mecanismo que rellene campos
nuevos agregados a `Room`/`Group` al restaurar un snapshot viejo. Hoy el único backfill real es
puntual y manual: `room.waitingPlayers ??= []`. Solo `rayado-libre` implementa
`migrateRound()` para su propio `round`.

- No construyas un framework de migraciones genérico.
- Si tu cambio agrega un campo nuevo a `Room`, `Group`, o a algún `Player`/`round` de engine
  que pueda faltar en un snapshot restaurado desde antes de tu cambio, sumá el backfill puntual
  en `persistence.ts` junto al de `waitingPlayers`.

### 2.7 Inconsistencia `require()` / `import` para el mismo módulo (`env`)

`env` se importa con `require("../env")` en 4 archivos (`auth/service/resendMailer.ts:15`,
`auth/service/tokenService.ts:14`, `auth/index.ts:16`, `db/client.ts:10`) y con
`import { env }` en otros 4. El patrón `require(...) as {...}` que sí es deliberado en este
repo existe para evitar ciclos de módulos entre backend core y `ws/`/`rooms/` — `env` no
participa de ese ciclo, así que acá la inconsistencia es real.

- Si tocás cualquiera de los 4 archivos con `require("../env")`, normalizalo a `import { env }
from "../env"` en el mismo cambio.

### 2.8 Engines inconsistentes en hooks opcionales de `GameEngine`

- `offlineKickTimeoutMs` no lo implementa ningún engine hoy, pero el comentario en
  `engineTypes.ts` (líneas 53-56) describe un comportamiento de Impostor que ya no existe
  (se sacó en el commit `fix(reconexion)` de la sesión donde se bajó el grace period a 1
  minuto) — documentación desactualizada sobre una feature removida.
- `torneo-futbol` y `recamara` no implementan `resetProgress` pese a acumular estado entre
  rondas — un "Volver al lobby" en esos dos juegos puede dejar estado viejo sin limpiar.

- Si tocás `engineTypes.ts` o cualquier engine, corregí el comentario desactualizado de
  `offlineKickTimeoutMs`.
- Si tocás `torneo-futbol` o `recamara` y el cambio toca su manejo de "volver al
  lobby"/estado entre rondas, evaluá si les falta `resetProgress`.

### 2.9 `try/catch` faltante en lecturas de DB (`auth/repository/userRepository.ts`)

`findByIdentifier`, `findById`, `findByEmail` no tienen `try/catch`, a diferencia de
`createUser`/`updateProfile` en el mismo archivo. No crashea el proceso (Express + Sentry ya
capturan como 500 genérico) pero rompe la consistencia de shape de error del resto del
archivo. Mismo patrón en `auth/service/resendMailer.ts:30`.

- Si tocás cualquiera de esas funciones, envolvela con el mismo patrón try/catch que ya usan
  sus vecinas del mismo archivo.

## Flujo de trabajo

1. Identificá qué archivo(s) de `backend/src/` vas a tocar (nuevo o existente).
2. Si es código nuevo: aplicá la Parte 1 (capas solo donde corresponde, separación
   infra/negocio, DRY, seguridad, tests) desde el primer commit.
3. Si es un archivo existente: revisalo contra los 9 gaps de la Parte 2, en el orden en que
   están listados, y corregí lo que encuentres ahí — no busques violaciones en el resto del
   repo.
4. Si la corrección es grande o ambigua (framework de migraciones, catálogo global de errores,
   enum de fases en todo el repo, aplicar ports/adapters a un módulo que hoy no los tiene),
   explicá el trade-off y preguntá antes de aplicarla.
5. Resumí al final qué se construyó/corrigió y por qué, para que el usuario no tenga que
   releer todo el diff.
