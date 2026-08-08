# Multiplayer (modo online)

Todo lo que necesita el modo "Multijugador online" para funcionar: la conexión
por WebSocket, las pantallas de cada etapa, y un par de utilidades chicas.
Esta carpeta no sabe nada de las reglas de ningún juego en particular — eso
vive en `frontend/src/games/<juego>/`. Lo que hay acá es genérico para
cualquier juego online.

## Conceptos clave (léelos antes de tocar código)

- **Sala (`Room`)**: una partida de un juego específico. Tiene un código de 5
  caracteres, una lista de jugadores, una fase (`lobby`, y después lo que
  defina el juego), y la config de ese juego.
- **Grupo (`Group`)**: un "lobby" persistente compartido — su propio código,
  su propia lista de miembros — que puede tener varias salas ("instancias")
  abiertas al mismo tiempo debajo suyo. Cualquier miembro abre una instancia;
  cada miembro decide por su cuenta si se une a ella o no.
- **Instancia**: una sala que pertenece a un grupo (en vez de ser standalone).
  Es la misma `Room` de siempre — no hay un tipo distinto — solo que tiene
  `groupCode` seteado y aparece en la lista de instancias abiertas del grupo.

Un jugador puede estar: solo en una sala standalone, solo en un grupo (sin
instancia activa), o en un grupo con una instancia activa (ambos casos a la
vez, mismo `playerId`).

## Cómo entrar al código (de más genérico a más específico)

1. **`MultiplayerGame.tsx`** — el shell/orquestador, pero solo el render: es
   el único archivo que sabe en qué pantalla estás (`connectionPhase`) y
   decide cuál de las 4 pantallas de `screens/` renderizar. Ver el
   comentario "MULTIPLAYER SHELL" al inicio del archivo para el detalle
   completo de los dos `entryKind` ("room" vs "group").

2. **`hooks/useMultiplayerGameShell.ts`** — dueño de todo el estado de
   sesión de ese shell (diálogos, toasts, joins pendientes) y de los
   handlers que lo modifican; envuelve a `useMultiplayerSocket` y le agrega
   toda la lógica que no es pura conexión. `MultiplayerGame.tsx` es el único
   consumidor.

3. **`hooks/useMultiplayerSocket.ts`** — la conexión en sí: abrir el socket,
   reconectar con backoff si se cae, guardar la sesión en `localStorage` para
   sobrevivir a que el navegador mate la pestaña de fondo, y traducir cada
   mensaje del servidor a estado de React. Consumido por
   `useMultiplayerGameShell`.

4. **`hooks/useValidJoinLink.ts`** — consume un link de "unirse" pendiente en
   la URL (`?join=CODE&...`) en la primera carga. Usado directo por
   `App.tsx`, antes incluso de que este shell monte.

5. **`screens/*.tsx`** — un componente por etapa, cada uno una pantalla pura
   (recibe props, renderiza; no tiene su propio estado de sesión):
   - `MenuScreen` — antes de conectar: elegir nombre, crear o unirse.
   - `GroupScreen` — adentro de un grupo, sin instancia activa.
   - `LobbyScreen` — adentro de una sala/instancia, antes de arrancar.
   - `RoundScreen` — la partida en sí — delega entero al `RoundView` del
     juego activo (este shell no conoce las fases de ningún juego puntual).

6. **`utils/joinLink.ts`** / **`utils/playerName.ts`** — helpers chicos y
   sin estado: armar/leer el link de "escanear y unirse", y persistir el
   nombre elegido en `localStorage`.

7. **`services/`** — lógica de conexión/sesión extraída de los hooks cuando
   crece demasiado para vivir ahí (ej. `multiplayerSocketService.ts` para el
   manejo bajo nivel del WebSocket, `multiplayerSession.ts` para persistencia
   de sesión). Es un patrón válido para separar responsabilidades dentro de
   una feature — si otro juego/feature necesita algo similar (lógica de red o
   sesión que un hook solo no puede seguir cargando con claridad), puede
   replicar esta misma carpeta `services/`.

## Si tenés que cambiar algo

- ¿Cambia cómo se ve una pantalla? → el archivo de `screens/` correspondiente.
- ¿Cambia qué datos viajan o cómo se reconecta? → `useMultiplayerSocket.ts`.
- ¿Cambia el estado de sesión/toasts/diálogos de este shell (no de una
  pantalla puntual)? → `useMultiplayerGameShell.ts`.
- ¿Cambia qué pantalla se muestra cuándo? → `MultiplayerGame.tsx`.
