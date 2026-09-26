# Rayado Libre

Juego de dibujo estilo Pictionary: un jugador dibuja una palabra secreta y
el resto adivina antes de que se acabe el tiempo. Existe en dos modos —
**online** (multijugador por WebSocket) y **local** (pantalla compartida,
juez manual) — que comparten reglas y la mayor parte de la presentación,
pero difieren en cómo se decide quién acertó.

Este documento cubre la organización interna de `games/rayado-libre/`. Para
el contrato general entre juegos (`GameDef`, `registry.ts`) ver
`frontend/src/games/README.md`; para el criterio de reorganización por
juego, `docs/REORGANIZACION_JUEGOS.md`.

## Arquitectura: online vs. local

|                          | Online (`RoundView.tsx`)                                                         | Local (`LocalGame.tsx`)                                               |
| ------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Quién decide el estado   | El motor del backend (`backend/src/games/rayado-libre/engine.ts`), vía WebSocket | El propio componente, en memoria del navegador                        |
| Quién dibuja             | Un jugador remoto, cada uno en su dispositivo                                    | Un dispositivo compartido pasado de mano en mano                      |
| Cómo se marca un acierto | Cada jugador escribe su intento en el chat (`guess`)                             | Quien tiene el dispositivo toca el nombre de quien acertó en voz alta |
| Puntaje                  | `@juntada/rayado-libre-scoring` (mismas fórmulas que el motor)                   | El mismo paquete — nunca se reimplementa la fórmula en el frontend    |

Ambos flujos siguen el mismo patrón de separación que el resto de los
juegos del repo: `RoundView.tsx`/`LocalGame.tsx` son los **orquestadores**
(dueños del estado, sin JSX complejo) y delegan cada fase a un componente
de presentación bajo `components/` (`*PhaseScreen.tsx` para online,
`Local*Screen.tsx`/`WordRevealScreen.tsx` para local).

## Fases del juego

1. **`lobby`** — configuración de categorías y cantidad de rondas
   (`SetupScreen.tsx`, compartida por ambos modos).
2. **`choosing`** — quien dibuja elige 1 de 3 palabras al azar
   (`ChoosingPhaseScreen.tsx` online, `WordRevealScreen.tsx` local). Si se
   acaba el tiempo sin elegir, se autoselecciona una (`forceReadyAndAdvance`
   en el motor).
3. **`drawing`** — el tablero en vivo, con temporizador y pista progresiva
   de la palabra (`DrawingPhaseScreen.tsx` / `LocalDrawingScreen.tsx`).
4. **`reveal`** — se muestra la palabra y la tabla de puntos de la ronda
   (`RevealPhaseScreen.tsx` / `LocalRevealScreen.tsx`).
5. **`result`** — tabla final de toda la partida, con podio
   (`ResultPhaseScreen.tsx` / `LocalResultScreen.tsx`).

El motor del backend (`engine.ts`) es la única fuente de verdad de estas
transiciones en el modo online; `LocalGame.tsx` replica la misma máquina de
estados a mano, ya que no hay servidor de por medio.

## Componentes compartidos entre online y local

Están en `components/` y son el punto de apoyo principal para no duplicar
UI entre los dos modos:

- **`DrawingBoard.tsx`** — el tablero completo (temporizador circular +
  `Canvas` + `Toolbar`, con hoja deslizable en mobile / columna fija en
  desktop). Recibe `sideContent` como slot para lo que sí difiere entre
  modos: el panel "Respuestas" (`chat/OnlineAnswersPanel`, online) vs. la
  lista de "¿quién acertó?" (`LocalGuessersPanel`, juez manual, local), las
  dos con la misma cabecera (`chat/ChatHeader`).
- **`Canvas.tsx`** — el tablero de dibujo a nivel píxel (pointer events,
  flood fill, pintado incremental optimista). No sabe nada de turnos ni
  puntaje.
- **`Toolbar.tsx`** — paleta de colores, grosor de trazo, deshacer/limpiar.
- **`choose/`** — la pantalla de elegir palabra (`ChooseWordPanel`) y su
  abanico de 3 cartas de papel (`WordCardFan`), online y local.
- **`TurnHeader.tsx`**, **`CircularTimer.tsx`**, **`HintText.tsx`** —
  piezas chicas de header reusadas en varias fases.
- **`reveal/`** — la revelación (`RevealView`: la palabra con su pincelada y
  la tabla del turno animada, con la secuencia en
  `hooks/useScoreTableSequence`), online y local.
- **`podium/`** — el podio final propio del juego (`RayadoPodium`), online y
  local; el `PodiumBoard` de game-kit lo siguen usando los demás juegos.
- **`ScreenSwap.tsx`** — la transición entre pantallas (sale la anterior,
  entra la nueva). Los efectos sueltos (manchas, puntos que vuelan,
  "¡Adivinaste!", confeti) viven en `hooks/useFxLayer` y se disparan desde
  `hooks/useGuessFx`.

Los componentes específicos de un solo modo (`chat/` salvo `ChatHeader`,
`WaitingForWordCard`, `EyeToggle` → online; `PassDeviceCard` → local) no
intentan unificarse con su equivalente del otro modo cuando la lógica de
fondo es genuinamente distinta — forzarlo sería exactamente el tipo de
abstracción prematura que este repo evita (ver CLAUDE.md, sección DRY/SoC).

## Backend

- **`backend/src/games/rayado-libre/engine.ts`** — implementa `GameEngine`
  (el contrato en `backend/src/games/engineTypes.ts`): fases, elección de
  palabra, puntaje por acierto, timers, y las vistas pública/privada que se
  mandan por WebSocket. El comentario de cabecera del archivo resume el
  ciclo completo de fases.
- **`packages/rayado-libre-scoring/`** — funciones puras compartidas entre
  el motor del backend y el modo local del frontend: `scoreForGuess`,
  `isCorrectGuess`, `isCloseGuess` ("¡Estás cerca!"), `buildHintOrder`/`computeWordHint` (pista progresiva),
  `popLastDrawUnit` (deshacer), y constantes (`TURN_SECONDS`,
  `MIN_PLAYERS`, `DRAWER_POINTS_PER_GUESS`, `TYPING_TTL_MS`). Ningún cálculo de puntaje se
  reimplementa en el frontend — todo importa de acá.
- **`packages/rayado-libre-data/`** — el pool de categorías/palabras y el
  algoritmo de selección de 3 palabras sin repetir (`pickThreeWords`),
  también compartido entre el motor y `LocalGame.tsx`.

## Tests

`tests/` sigue el criterio general del repo: un archivo de test por
archivo que testea, con imports relativos hacia afuera de la carpeta
(`../LocalGame`, no `./LocalGame`).

- `LocalGame.test.tsx` — flujo completo del modo local (elegir palabra,
  marcar aciertos, llegar a la tabla final).
- `RoundView.test.tsx` — fases "choosing"/"drawing" del modo online.
- `ConfigPanel.test.tsx`, `ChatFeed.test.tsx` — componentes puntuales; `chatFeed`,
  `typing` y `useChatFeedback` cubren las reglas del chat de respuestas.

Antes de dar un cambio por terminado: `pnpm --filter @juntada/frontend
typecheck`, `pnpm --filter @juntada/backend typecheck`, y los tests de
arriba en verde (ver CLAUDE.md para el checklist completo del repo).
