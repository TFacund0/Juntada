# Componentes compartidos

Piezas reutilizables usadas por más de un juego (y por el shell de la app,
`App.tsx`). Nada acá conoce las reglas de un juego en particular — un
componente que solo tiene sentido para un juego específico vive dentro de la
carpeta `components/` propia de ese juego (ej. `games/impostor/components/`).

Agrupados por para qué sirven, no alfabéticamente:

## Shell de la app (home, header, navegación)

- `AppHeader` — el header que se muestra arriba de cada pantalla (logo/
  título, Volver/Menú principal, texto del paso actual, la pill de nombre +
  menú de grupo en la pantalla de inicio).
- `GamePicker` / `GameDetailDialog` — el catálogo de juegos de la pantalla de
  inicio y el diálogo de vista previa que se abre al tocar una tarjeta.
- `ModePicker` — "elegí cómo jugar": Multijugador online vs. Modo local.
- `NameOnboardingScreen` — la primerísima pantalla de "¿cómo te llamás?".
- `NamePillEditor` — la pill chica que muestra/edita el nombre guardado.
- `GameRules` — renderiza el `GameDef.rules` de un juego.
- `ComingSoon` — pantalla placeholder para un juego marcado `comingSoon`.
- `DevNoticeDialog` — el aviso único de "app en desarrollo".

## Diálogos

- `DialogFrame` — el overlay + card centrada compartido en el que se arma
  cada diálogo de abajo. Cambiar el look del modal (radio de bordes,
  oscuridad del overlay, etc.) se hace acá, una sola vez, en vez de en cada
  diálogo por separado.
- `ConfirmDialog` — el "¿estás seguro?" genérico de confirmar/cancelar.
- `QRDialog` — muestra un código de sala/grupo como QR + link para compartir.
- `QRScannerDialog` — abre la cámara del dispositivo para escanear un QR
  (decodifica localmente con `jsQR`, nunca se sube nada a ningún lado).

## Pantallas de setup/lobby (local y online, por juego)

- `SetupTabs` — el split de tabs Jugadores/Configuración arriba de una
  pantalla de setup.
- `StickyActionBar` / `StartButton` — la acción principal de "arrancar",
  fijada abajo de un setup/lobby con scroll.
- `AddPlayerForm` — el formulario de "sumar jugador" usado por los modos
  locales que arman su propia lista de jugadores.
- `TurnOrderEditor` — editor de arrastrar/reordenar para `room.config.turnOrder`.
- `MinPlayersHint` — "Necesitás mínimo N jugadores", no renderiza nada una
  vez cumplido el mínimo.
- `TabRow` — el switcher genérico de tabs que usan `SetupTabs`/los
  ConfigPanel.

## Flujo de ronda/resultado (local y online, por juego)

- `PhaseTransition` — envuelve la pantalla de una fase para que cambiar de
  fase se sienta como una transición en vez de un cambio instantáneo
  (remonta al cambiar `phaseKey`).
- `RevealCountdown` — el momento de suspenso antes de mostrar el resultado
  de una ronda.
- `Timer` — una cuenta regresiva impulsada por un `endsAt` del servidor.
- `BackButton` / `ConfirmBackButton` — la acción secundaria de "volver"
  debajo de una principal; la variante `Confirm` pide confirmación antes de
  disparar (volver/terminar/reiniciar).
- `LeaveToLobbyButton` — la salida online de "volver al lobby" (mid-ronda/
  resultado).
- `ReturnToGroupButton` — la salida online de "volver al grupo" para una
  instancia de grupo.

## UI genérica chica

- `Btn` — el único componente de botón por el que pasa cada variante
  (`primary`/`success`/`danger`/`ghost`).
- `Toggle` — el switch on/off.
- `Toast` — un mensaje breve que se auto-cronometra (avisos de estado,
  "fulano se reconectó", etc.).
- `ErrorBanner` — un mensaje de error que se auto-destella (funciona junto
  con `hooks/useFlashError.ts`).
- `Collapsible` — sección que se expande/colapsa.
- `Avatar` — la insignia de inicial/color de un jugador.
- `CodeDisplay` — la visualización grande del código de sala/grupo.
- `QRCode` — el renderizado crudo del QR (usado por `QRDialog`).

## Si necesitás cambiar algo

- ¿Se ve mal en todas las pantallas a la vez? Probablemente sea uno de estos
  archivos.
- ¿Se ve mal solo en la pantalla de un juego? Fijate primero en la carpeta
  `components/` propia de ese juego — probablemente no sea compartido.
