# 🎉 Juntada

Plataforma de juegos para jugar en grupo — cada juego se puede jugar en **modo local**
(un dispositivo que se pasa por turnos) o en **modo multijugador online** (cada uno
desde su celular, conectados por código de sala).

Actualmente jugables: 🕵️ **El Impostor**, 🏆 **Torneo FIFA** y 🎡 **Ruleta**. El
resto de los juegos del menú (Sintonía, Tutifrutti, Ta-Te-Ti, Trivia, Limón
Limón) están registrados pero marcados como "Próximamente" — ver
[Agregar un juego nuevo](#-agregar-un-juego-nuevo).

---

## 📁 Estructura del proyecto

Monorepo con pnpm workspaces:

```
juntada/
├── backend/                    @juntada/backend — Express + WebSocket
│   ├── server.js                entry point (levanta el puerto)
│   ├── src/
│   │   ├── app.js                composición de express + http + ws
│   │   ├── rooms/                 lifecycle GENÉRICO de salas (crear/unir/kick/reconectar)
│   │   ├── games/
│   │   │   ├── registry.js        contrato + registro de motores de juego
│   │   │   └── impostor/          motor específico de El Impostor
│   │   ├── ws/                    transporte WS, validación, rate limiting
│   │   ├── state/                 Maps en memoria (rooms, clients, timers)
│   │   └── http/                  rutas HTTP (health, estáticos del frontend)
│   └── test/                     tests unitarios del motor de juego (node --test)
│
├── frontend/                   @juntada/frontend — React + Vite
│   └── src/
│       ├── App.jsx                shell: elegir juego → elegir modo
│       ├── games/
│       │   ├── registry.js        contrato + registro de juegos (frontend)
│       │   └── impostor/          LocalGame, ConfigPanel, RoundView
│       ├── features/multiplayer/  shell de sala/lobby genérico + hook de WS
│       ├── components/            UI reutilizable (Btn, Avatar, Timer, ...)
│       └── theme/                 estilos
│
└── packages/
    └── impostor-data/           @juntada/impostor-data — categorías/palabras
                                   compartidas entre backend y frontend (modo local)
```

**Por qué está separado así:** el manejo de salas (crear, unirse, reconectar, expulsar,
límites) es 100% genérico y no sabe nada de ningún juego en particular. Cada juego
implementa un contrato (ver `backend/src/games/registry.js` y
`frontend/src/games/registry.js`) y se enchufa registrándose ahí. Agregar un juego
nuevo no debería requerir tocar `roomService.js`, `handlers.js`, `App.jsx` ni
`MultiplayerGame.jsx`.

---

## ⚙️ Desarrollo

Requiere [pnpm](https://pnpm.io/).

```bash
pnpm install
```

Correr backend y frontend en paralelo (dos terminales):

```bash
pnpm dev:backend    # http://localhost:3001 (WebSocket + API)
pnpm dev:frontend   # http://localhost:5173 (Vite, con hot-reload)
```

Abrí `http://localhost:5173`. En dev, el frontend apunta el WebSocket directo al
puerto del backend (`3001`) — ver `frontend/src/features/multiplayer/useMultiplayerSocket.js`.

Para probar el modo multijugador desde otro dispositivo en tu misma red, usá la IP
que te muestra Vite (`Network: http://192.168.x.x:5173`) en vez de `localhost`.

### Tests

```bash
pnpm --filter @juntada/backend test
```

---

## 🚀 Producción (un solo servicio)

En producción, el backend sirve el frontend ya buildeado desde el mismo proceso
(sin CORS, sin dos dominios):

```bash
pnpm build:frontend   # genera frontend/dist
pnpm start            # levanta el backend en $PORT, sirviendo frontend/dist
```

### Deploy en Render (gratis)

El repo incluye `render.yaml`. En [render.com](https://render.com), **New → Blueprint**,
conectar este repo — Render detecta el `render.yaml` y usa:

- **Build:** `pnpm install && pnpm build:frontend`
- **Start:** `pnpm start`
- **Health check:** `/health`

Limitaciones del plan free: el servicio se duerme tras ~15 min sin tráfico (la
próxima visita tarda ~30-50s en despertar), y el estado (salas activas) vive en
memoria — se pierde si el servicio se reinicia. Ninguna de las dos cosas rompe el
juego, solo hay que tenerlas en cuenta.

---

## ➕ Agregar un juego nuevo

1. **Backend:** crear `backend/src/games/<id>/engine.js` implementando el contrato
   descripto en `backend/src/games/registry.js` (`createConfig`, `startRound`,
   `maybeAdvance`, `handleAction`, `getPublicRoundView`, `getPrivateView`,
   opcionalmente `getRevealMessage`). Registrarlo en `registry.js`.
2. **Frontend:** crear `frontend/src/games/<id>/` con `LocalGame`, `ConfigPanel`,
   `RoundView` e `index.jsx` armando el objeto del juego (ver
   `frontend/src/games/impostor/index.js` como referencia). Registrarlo en
   `frontend/src/games/registry.js`.
3. Listo — el juego aparece solo en el menú (local y multijugador), sin tocar
   `App.jsx`, `MultiplayerGame.jsx`, `roomService.js` ni `handlers.js`.

Mientras se construye, se puede registrar con `comingSoon: true` y componentes
placeholder (`components/ComingSoon.jsx`) para que aparezca en el menú sin ser
jugable todavía — así están hoy Sintonía, Tutifrutti, Ta-Te-Ti y Trivia.

---

## 🕵️ El Impostor — cómo se juega

- Un jugador (o varios, configurable) recibe el rol de impostor y no ve la palabra
  real, solo la categoría (si las pistas están activadas).
- El resto ve la misma palabra secreta.
- Cada uno da una pista relacionada, sin decir la palabra directamente.
- Se vota a quién se sospecha; el más votado es eliminado y se revela si era o no
  el impostor.

Configuración disponible: cantidad de impostores (1-3), pistas al impostor
on/off, tiempo límite para dar pistas (0 = sin límite), y qué categorías de
palabras están habilitadas.

---

## 🎡 Ruleta — cómo se juega

Juego local (`localOnly: true`, sin backend): se cargan entradas con un nombre
y, opcionalmente, una descripción más larga (por ejemplo el castigo o la
prenda asociada), y se gira una ruleta real (SVG animado con desaceleración).

Dos modos:

- **Repetir:** se mantienen todas las entradas y se puede girar las veces que
  se quiera. Hay un panel colapsable para ver cuántas veces salió cada opción.
- **Eliminación:** la entrada que sale se saca de la ruleta; se muestra el
  listado con el orden en que fueron eliminadas.

---

## 📝 Notas técnicas

- Sin base de datos: todo el estado vive en memoria del proceso (`Map`s en
  `backend/src/state/roomStore.js`). Simple y suficiente para el tamaño de esta app;
  si algún día importa sobrevivir a un reinicio, ahí se agregaría persistencia.
- Reconexión: si un jugador pierde la conexión WS, el cliente reintenta y se
  re-asocia a su sala/jugador mediante un mensaje `rejoin` — no pierde su lugar en
  la partida en curso mientras la sala siga viva.
- Los mensajes WS entrantes se validan con `zod` (`backend/src/ws/validation.js`) y
  hay rate limiting básico por IP en `create_room`/`join_room`
  (`backend/src/ws/rateLimiter.js`) — el servidor es público, no confía ciegamente
  en el cliente.
