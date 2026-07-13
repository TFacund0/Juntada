# Juntada

Plataforma de juegos para jugar en grupo — cada juego se puede jugar en **modo
local** (un dispositivo que se pasa por turnos) o en **modo multijugador
online** (cada uno desde su celular, conectados por código de sala o de
grupo).

Jugables hoy: El Impostor, Torneo FIFA, Ruleta, Ta-Te-Ti, Sintonía, Limón
Limón y Tutifrutti. Trivia y Codenames están registrados pero marcados como
"Próximamente" — ver [Agregar un juego nuevo](#agregar-un-juego-nuevo).

El primer uso pide un nombre de jugador una única vez (se guarda en el
dispositivo) y, desde ahí, se puede crear o unirse tanto a una sala suelta
para un juego puntual como a un grupo persistente donde varios juegos se
abren y cierran sin perder al resto de los integrantes — ver
[Salas y grupos](#salas-y-grupos).

Stack: TypeScript de punta a punta (backend y frontend), React + Vite,
WebSocket + Express, sin base de datos.

---

## Estructura del proyecto

Monorepo con pnpm workspaces:

```
juntada/
├── backend/                    @juntada/backend — Express + WebSocket
│   ├── server.ts                entry point
│   ├── src/
│   │   ├── app.ts                composición de express + http + ws
│   │   ├── env.ts                validación de variables de entorno (zod)
│   │   ├── logger.ts             logging estructurado (pino)
│   │   ├── rooms/                 lifecycle genérico de salas y grupos
│   │   │   ├── roomService.ts      crear/unir/kick/reconectar una sala (una partida)
│   │   │   └── groupService.ts     crear/unir/reconectar un grupo (varias salas)
│   │   ├── games/
│   │   │   ├── registry.ts        registro de motores de juego
│   │   │   ├── engineTypes.ts     contrato GameEngine compartido por todos los motores
│   │   │   ├── impostor/          motor específico de El Impostor
│   │   │   ├── torneo-fifa/       motor específico de Torneo FIFA
│   │   │   ├── tateti/            motor específico de Ta-Te-Ti
│   │   │   ├── sintonia/          motor específico de Sintonía
│   │   │   ├── limon-limon/       motor específico de Limón Limón
│   │   │   ├── tutifruti/         motor específico de Tutifrutti
│   │   │   └── ruleta/            motor específico de Ruleta
│   │   ├── ws/                    transporte WS, validación, rate limiting
│   │   ├── state/                 Maps en memoria (rooms, groups, clients, timers)
│   │   └── http/                  rutas HTTP (health, estáticos del frontend)
│   └── test/                     tests unitarios (node --test)
│
├── frontend/                   @juntada/frontend — React + Vite
│   └── src/
│       ├── App.tsx                shell: nombre de jugador → elegir juego → elegir modo
│       ├── games/
│       │   ├── registry.ts        registro de juegos (frontend)
│       │   ├── gameTypes.ts       contrato GameDef compartido por todos los juegos
│       │   ├── impostor/          LocalGame, ConfigPanel, RoundView
│       │   ├── torneo-fifa/       LocalGame, ConfigPanel, RoundView
│       │   ├── tateti/            LocalGame, ConfigPanel, RoundView
│       │   ├── ruleta/            LocalGame, ConfigPanel, RoundView, LobbyInfo
│       │   ├── sintonia/          LocalGame, ConfigPanel, RoundView, Dial
│       │   ├── limon-limon/       LocalGame, ConfigPanel, RoundView, cartas dibujadas en SVG
│       │   └── tutifruti/         LocalGame, ConfigPanel, RoundView, LobbyInfo
│       ├── features/multiplayer/  shell de sala/grupo genérico + hook de WS
│       │   ├── MultiplayerGame.tsx     UI de conectar/crear/unirse y el lobby de grupo
│       │   ├── useMultiplayerSocket.ts hook de WebSocket (conexión, reconexión, sesión)
│       │   └── playerName.ts           nombre de jugador persistido en localStorage
│       ├── components/            UI reutilizable (Btn, Avatar, Timer, ...)
│       ├── test/                  setup y mocks para Vitest
│       └── theme/                 estilos
│
└── packages/
    ├── shared-types/            @juntada/shared-types — contrato de mensajes WS
    │                              (ClientMessage/ServerMessage) y de Room/Group/Player,
    │                              compartido entre backend y frontend
    ├── impostor-data/           @juntada/impostor-data — categorías/palabras
    ├── sintonia-data/           @juntada/sintonia-data — pares de conceptos opuestos
    └── tutifruti-data/          @juntada/tutifruti-data — categorías y letras
```

**Por qué está separado así:** el manejo de salas (crear, unirse, reconectar,
expulsar, límites) es genérico y no sabe nada de ningún juego en particular.
Cada juego implementa un contrato (`GameEngine` en el backend, `GameDef` en
el frontend) y se enchufa registrándose en su `registry.ts`. Agregar un
juego nuevo no debería requerir tocar `roomService.ts`, `handlers.ts`,
`App.tsx` ni `MultiplayerGame.tsx`.

Ver [WEBSOCKET.md](./WEBSOCKET.md) para la referencia completa de mensajes
cliente↔servidor.

---

## Salas y grupos

Hay dos formas de entrar al modo online:

- **Sala suelta:** se elige un juego puntual desde el menú y se crea o se
  une una sala con ese único juego (`create_room` / `join_room`). Al
  terminar, la sala queda en el lobby lista para otra ronda o para
  volver al menú.
- **Grupo:** un lobby persistente, con su propio código, donde cualquier
  integrante puede abrir una instancia de cualquier juego habilitado
  (`create_instance`) y el resto decide por su cuenta si se suma
  (`join_instance`) o se queda mirando otra cosa. Varias instancias pueden
  estar abiertas al mismo tiempo bajo el mismo grupo, y salir de una
  (`leave_instance`) no saca a nadie del grupo en sí (`leave_group`).

Un jugador desconectado (se le cortó el WiFi, se le apagó la pantalla) queda
marcado como offline pero conserva su lugar durante una ventana de gracia; si
vuelve a conectarse a tiempo, un `rejoin`/`rejoin_group` lo reintegra a donde
estaba sin que nadie más note la diferencia. Pasado ese tiempo sin volver, se
lo expulsa automáticamente para no dejar trancado al resto.

---

## Desarrollo

Requiere [pnpm](https://pnpm.io/).

```bash
pnpm install
```

Correr backend y frontend en paralelo (dos terminales):

```bash
pnpm dev:backend    # http://localhost:3001 (WebSocket + API)
pnpm dev:frontend   # http://localhost:5173 (Vite, con hot-reload)
```

Abrí `http://localhost:5173`. En dev, el frontend apunta el WebSocket directo
al puerto del backend (`3001`) — ver
`frontend/src/features/multiplayer/useMultiplayerSocket.ts`.

Para probar el modo multijugador desde otro dispositivo en tu misma red, usá
la IP que muestra Vite (`Network: http://192.168.x.x:5173`) en vez de
`localhost`.

Variables de entorno: ver `backend/.env.example` y `frontend/.env.example`.
El backend valida sus variables al arrancar (`backend/src/env.ts`) — un
valor inválido falla explícito, no en silencio.

### Tests

```bash
pnpm --filter @juntada/backend test     # node --test — lifecycle de salas/grupos + motores de juego
pnpm --filter @juntada/frontend test    # vitest — hook de WebSocket, etc.
```

### Tipos, lint y formato

```bash
pnpm --filter @juntada/backend typecheck
pnpm --filter @juntada/frontend typecheck
pnpm lint            # eslint en todo el monorepo
pnpm format          # prettier --write
pnpm format:check
```

---

## Producción (un solo servicio)

En producción, el backend sirve el frontend ya buildeado desde el mismo
proceso (sin CORS, sin dos dominios):

```bash
pnpm build:frontend   # genera frontend/dist
pnpm start            # levanta el backend en $PORT, sirviendo frontend/dist
```

### Deploy en Render

El repo incluye `render.yaml`. En [render.com](https://render.com), **New →
Blueprint**, conectar este repo — Render detecta el `render.yaml` y usa:

- **Build:** `pnpm install && pnpm build:frontend`
- **Start:** `pnpm start`
- **Health check:** `/health`

Limitaciones del plan free: el servicio se duerme tras ~15 min sin tráfico
(la próxima visita tarda ~30-50s en despertar), y el estado (salas activas)
vive en memoria — se pierde si el servicio se reinicia. Ninguna de las dos
cosas rompe el juego, solo hay que tenerlas en cuenta.

---

## Agregar un juego nuevo

1. **Backend:** crear `backend/src/games/<id>/engine.ts` implementando el
   contrato `GameEngine` (`backend/src/games/engineTypes.ts`): `createConfig`,
   `startRound`, `maybeAdvance`, `handleAction`, `getPublicRoundView`,
   `getPrivateView`, opcionalmente `getRevealMessage`. Registrarlo en
   `registry.ts`.
2. **Frontend:** crear `frontend/src/games/<id>/` con `LocalGame`,
   `ConfigPanel`, `RoundView` e `index.tsx` armando el objeto `GameDef`
   (`frontend/src/games/gameTypes.ts`; ver `games/impostor/index.tsx` como
   referencia). Registrarlo en `frontend/src/games/registry.ts`.
3. Listo — el juego aparece solo en el menú (local y multijugador), sin
   tocar `App.tsx`, `MultiplayerGame.tsx`, `roomService.ts` ni `handlers.ts`.

Mientras se construye, se puede registrar con `comingSoon: true` y
componentes placeholder (`components/ComingSoon.tsx`) para que aparezca en
el menú sin ser jugable todavía — así están hoy Trivia y Codenames. Si el
juego todavía no tiene ni reglas claras, dejar un `DESIGN.md` en su carpeta
con el contexto (ver `frontend/src/games/codenames/DESIGN.md`) para no tener
que volver a explicarlo desde cero más adelante.

---

## El Impostor — cómo se juega

- Un jugador (o varios, configurable) recibe el rol de impostor y no ve la
  palabra real, solo la categoría (si las pistas están activadas).
- El resto ve la misma palabra secreta.
- Cada uno da una pista relacionada, sin decir la palabra directamente.
- Se vota a quién se sospecha; el más votado es eliminado y se revela si era
  o no el impostor.

Configuración disponible: cantidad de impostores (1-3), pistas al impostor
on/off, tiempo límite para dar pistas (0 = sin límite), y qué categorías de
palabras están habilitadas.

---

## Torneo FIFA — cómo se juega

Organizador de bracket para sesiones de FIFA entre amigos: sorteo de
equipos y eliminación directa, con estadísticas de goles opcionales.

- Cada jugador queda asignado a un equipo (sorteado con una ruleta o elegido
  a mano) antes de arrancar.
- Se arma un cuadro de eliminación directa: si la cantidad de jugadores no
  es una potencia de 2, algunos pasan directo a la siguiente ronda ("bye").
- Los cruces se pueden reordenar antes de iniciar el torneo.
- Cada partido se resuelve cargando el resultado: goles de cada lado (si se
  activó "contabilizar goles") o directamente quién ganó.
- El ganador de cada cruce avanza a la siguiente ronda hasta que quede un
  solo campeón. Si se contabilizan goles, al final se muestra una tabla con
  goleador y valla menos vencida del torneo.

Disponible en modo local (un dispositivo) y online, cada uno viendo los
cruces y resultados en vivo desde su celular
(`backend/src/games/torneo-fifa/engine.ts`).

---

## Ruleta — cómo se juega

Se cargan entradas con un nombre y, opcionalmente, una descripción más larga
(por ejemplo el castigo o la prenda asociada), y se gira una ruleta real
(SVG animado con desaceleración).

Dos modos:

- **Repetir:** se mantienen todas las entradas y se puede girar las veces
  que se quiera. Hay un panel colapsable para ver cuántas veces salió cada
  opción.
- **Eliminación:** la entrada que sale se saca de la ruleta; se muestra el
  listado con el orden en que fueron eliminadas. Cuando queda una sola
  entrada, se corta la ronda y se la destaca como ganadora.

Disponible en modo local (un dispositivo que carga las entradas y gira) y
online (`backend/src/games/ruleta/engine.ts`): el anfitrión carga las
entradas y el modo desde el lobby, y es quien gira la ruleta durante la
ronda — el servidor decide cada resultado de forma autoritativa para que
todos vean la misma rueda frenar en el mismo lugar al mismo tiempo. Las
tablas de eliminación y de conteo solo se actualizan una vez que termina la
animación de cada giro, para no arruinar la sorpresa antes de que el
anfitrión confirme y siga.

---

## Ta-Te-Ti — cómo se juega

El clásico 3 en raya, 1v1, en ambos modos:

- **Local:** un solo dispositivo que se pasa por turnos — cada uno toca su
  casillero cuando le toca.
- **Online:** sala de a dos, cada uno desde su celular
  (`backend/src/games/tateti/engine.ts`).

En los dos modos se puede repetir la cantidad de partidas que se quiera: el
marcador (victorias de cada uno + empates) se mantiene entre revanchas y
quién arranca alterna en cada partida nueva. En modo online, tanto la
revancha como el reinicio del marcador necesitan que **ambos** jugadores
estén de acuerdo (cada uno confirma su lado antes de que el servidor actúe).

---

## Sintonía — cómo se juega

Estilo _Wavelength_: en cada ronda alguien es el "psíquico" y ve un punto
secreto en un dial entre dos conceptos opuestos (por ejemplo "Frío" ↔
"Caliente"). Dice (o escribe) una pista relacionada a ese punto sin
nombrarlo directamente, y el resto adivina por turnos moviendo la aguja. Al
final se revela el objetivo con la marca de cada uno y los puntos ganados.

Antes de cada ronda se puede elegir:

- **Quién es el psíquico:** el sugerido por turno, cualquier otro jugador a
  mano, o al azar.
- **Qué par de conceptos usar:** uno al azar de la base incluida, o
  escribirlo uno mismo.

Puntaje: cada jugador que adivina anota según qué tan cerca cayó su marca
del objetivo (4/3/2/0 puntos según la zona), y el psíquico se lleva la suma
de lo que ganaron entre todos los que adivinaron — así una buena pista vale
tanto como acertarla en persona.

Se juega desde 2 jugadores en adelante, tanto local (un dispositivo que se
pasa por turnos para adivinar) como online
(`backend/src/games/sintonia/engine.ts`).

---

## Limón Limón — cómo se juega

Juego de mazo con baraja española (40 cartas, 4 palos): el mazo queda en el
centro de la ronda y, por turnos, alguien lo toca para revelar la carta de
arriba. El grupo decide siempre a mano quién se la queda — el juego nunca
asigna nada solo, solo muestra como referencia el significado de esa carta
puntual (número + palo) para recordar la regla. Las 40 cartas comparten las
mismas reglas entre los 4 palos, con una sola excepción: el 1 de oro duplica
el castigo, mientras que en copa/espada/basto es un castigo simple. Esos
significados son editables antes de arrancar (y desde el lobby en modo
online).

- **Local:** un dispositivo que se pasa por turnos. Se pueden sumar
  jugadores en cualquier momento, incluso a mitad de partida.
- **Online:** cada uno desde su celular
  (`backend/src/games/limon-limon/engine.ts`). El anfitrión puede reordenar
  el turno desde el lobby, y decide si el resto puede espiar el puntaje
  durante la ronda o si se revela recién al final.

Cualquier jugador puede votar para terminar la partida antes de vaciar el
mazo — con la mitad de los jugadores online de acuerdo, se corta ahí mismo y
se muestra la tabla tal como está en ese momento (si quedaba una carta
revelada sin repartir, se marca aparte como "sin repartir", no se pierde ni
se le suma a nadie). Al terminar (por mazo vacío o por votación), gana quien
juntó menos cartas.

---

## Tutifrutti — cómo se juega

Stop/Basta clásico: se sortea una letra y todos completan, a contrarreloj (o
hasta que alguien grite "¡Basta!"), una lista de categorías (país, animal,
color, ...) con una palabra que empiece con esa letra. Al terminar, entre
todos marcan con tilde o cruz cada respuesta de los demás antes de sumar
puntos.

- Una palabra válida y no repetida vale 10 puntos.
- Una palabra repetida con otro jugador vale la mitad.
- Una palabra con más cruces que tildes no suma puntos.

Se juegan varias rondas (configurable por el anfitrión) y gana quien más
puntos acumule. Disponible en modo local (sugerencia de letra y categorías,
sin puntaje) y online, con puntaje y clasificación completos
(`backend/src/games/tutifruti/engine.ts`).

---

## Notas técnicas

- **Sin base de datos:** todo el estado vive en memoria del proceso (`Map`s
  en `backend/src/state/roomStore.ts`). Simple y suficiente para el tamaño
  de esta app; si algún día importa sobrevivir a un reinicio, ahí se
  agregaría persistencia.
- **Reconexión:** si un jugador pierde la conexión WS, el cliente reintenta
  y se re-asocia a su sala/jugador mediante un mensaje `rejoin` — no pierde
  su lugar en la partida en curso mientras la sala siga viva (grace period
  de 5 minutos). El servidor además hace heartbeat (ping/pong) sobre cada
  conexión para detectar sockets muertos que nunca mandan un `close` limpio
  (celular que se queda sin batería, por ejemplo).
- **Validación:** los mensajes WS entrantes se validan con `zod`
  (`packages/shared-types/index.ts`, consumido por
  `backend/src/ws/validation.ts`) y hay rate limiting básico por IP en
  `create_room`/`join_room` (`backend/src/ws/rateLimiter.ts`) — el servidor
  es público, no confía ciegamente en el cliente. `update_config`, al ser
  genérico para cualquier juego, acepta cualquier clave pero solo valores
  acotados (string/número/boolean, o arrays/objetos de esos primitivos).
- **Errores:** todo error que manda el servidor por WS tiene el mismo shape
  (`{ type: "error", code, message }`, ver `WEBSOCKET.md`), construido en un
  solo lugar (`sendError()` en `backend/src/ws/messaging.ts`). Si el
  servidor rechaza una acción durante la ronda, el error se muestra como un
  banner arriba del `RoundView` — se maneja una sola vez en
  `MultiplayerGame.tsx`, ningún juego necesita mostrarlo por su cuenta.
- **Logging:** estructurado con Pino (`backend/src/logger.ts`) — JSON en
  producción, formateado y coloreado en dev. Cubre creación/cierre de sala,
  handoff de host, kicks y errores no manejados en un handler.
- **Identidad de jugador:** el nombre se pide una sola vez al abrir la app y
  se guarda en `localStorage` (`frontend/src/features/multiplayer/playerName.ts`),
  así crear o unirse a salas y grupos nunca lo vuelve a preguntar. El
  servidor no permite dos jugadores con el mismo nombre (sin distinguir
  mayúsculas) dentro de la misma sala o grupo; si el join es rechazado por
  eso, la UI abre ahí mismo un campo para cambiarlo y reintentar, sin
  volver al menú principal.
