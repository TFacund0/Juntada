# Componentes compartidos

Piezas reutilizables usadas por más de un juego (y por el shell de la app,
`App.tsx`). Nada acá conoce las reglas de un juego en particular — un
componente que solo tiene sentido para un juego específico vive dentro de la
carpeta `components/` propia de ese juego (ej. `games/impostor/components/`).

Organizados en subcarpetas por para qué sirven, no alfabéticamente:

## `shell/` — home, header, navegación

- `AppHeader` — el header que se muestra arriba de cada pantalla (logo/
  título, Volver/Menú principal, texto del paso actual, la pill de nombre +
  menú de grupo en la pantalla de inicio).
- `GroupMenuDropdown` / `ProfilePanel` — el menú desplegable y el panel de
  perfil que abre `AppHeader`.
- `Hero` — el encabezado visual de la pantalla de inicio.
- `GamePicker` / `GameDetailDialog` — el catálogo de juegos de la pantalla de
  inicio y el diálogo de vista previa que se abre al tocar una tarjeta.
- `ModePicker` — "elegí cómo jugar": Multijugador online vs. Modo local.
- `NamePillEditor` — la pill chica que muestra/edita el nombre guardado.
- `GameRules` — renderiza el `GameDef.rules` de un juego.
- `DevNoticeDialog` — el aviso único de "app en desarrollo".
- `AppBackdrop` — la cortina de transición + imagen/emoji de fondo del tema
  activo, detrás de toda la app.
- `AppConfirmDialogs` — los `ConfirmDialog` de nivel-app (volver, resetear
  local, salir, volver-al-grupo) que dispara `App.tsx`/`useAppNavigation`.
- `AppErrorBoundary` — el fallback de nivel raíz para cualquier error de
  render no atrapado por un boundary más específico; se monta en `main.tsx`
  envolviendo `<RouterProvider/>`, así que también atrapa errores del propio
  `App.tsx`. Distinto de `GameLoadErrorBoundary`: no reintenta recargar
  automáticamente ante un chunk-404 (a este nivel eso sería un loop de
  recarga sin salida), solo muestra "Algo salió mal" + un botón "Recargar".

## `dialogs/` — piezas de modal compartidas

- `DialogFrame` — el overlay + card centrada compartido en el que se arma
  cada diálogo de abajo. Cambiar el look del modal (radio de bordes,
  oscuridad del overlay, etc.) se hace acá, una sola vez, en vez de en cada
  diálogo por separado.
- `ConfirmDialog` — el "¿estás seguro?" genérico de confirmar/cancelar.
- `QRDialog` — muestra un código de sala/grupo como QR + link para compartir.
- `QRScannerDialog` — abre la cámara del dispositivo para escanear un QR
  (decodifica localmente con `jsQR`, nunca se sube nada a ningún lado).

## `setup/` — pantallas de setup/lobby (local y online, por juego)

- `SetupTabs` — el split de tabs Jugadores/Configuración arriba de una
  pantalla de setup.
- `TabRow` — el switcher genérico de tabs que usan `SetupTabs`/los
  ConfigPanel.
- `StickyActionBar` / `StartButton` — la acción principal de "arrancar",
  fijada abajo de un setup/lobby con scroll.

## `ui/` — UI genérica chica

- `Btn` — el único componente de botón por el que pasa cada variante
  (`primary`/`success`/`danger`/`ghost`).
- `Toast` — un mensaje breve que se auto-cronometra (avisos de estado,
  "fulano se reconectó", etc.).
- `ErrorBanner` — un mensaje de error que se auto-destella (funciona junto
  con `hooks/useFlashError.ts`).
- `Avatar` — la insignia de inicial/color de un jugador.
- `CodeDisplay` — la visualización grande del código de sala/grupo.
- `QRCode` — el renderizado crudo del QR (usado por `dialogs/QRDialog`).
- `ScreenFade` — wrapper de transición fade entre pantallas.

## `game-kit/` — piezas de setup/ronda reusadas solo por `games/**`

Estas no las importa el shell (`App.tsx`, `features/multiplayer/**`); viven
acá porque las comparte más de un juego, pero conceptualmente son "kit para
armar un juego local/online", no parte de la navegación de la app.

- `AddPlayerForm` — el formulario de "sumar jugador" usado por los modos
  locales que arman su propia lista de jugadores.
- `TurnOrderEditor` / `TurnCircle` — editor de arrastrar/reordenar para
  `room.config.turnOrder` y el indicador visual de a quién le toca.
- `MinPlayersHint` — "Necesitás mínimo N jugadores", no renderiza nada una
  vez cumplido el mínimo.
- `PhaseTransition` — envuelve la pantalla de una fase para que cambiar de
  fase se sienta como una transición en vez de un cambio instantáneo
  (remonta al cambiar `phaseKey`).
- `RevealCountdown` — el momento de suspenso antes de mostrar el resultado
  de una ronda.
- `Timer` — una cuenta regresiva impulsada por un `endsAt` del servidor.
- `Toggle` — el switch on/off.
- `Collapsible` — sección que se expande/colapsa.
- `ComingSoon` — pantalla placeholder para un juego marcado `comingSoon`.
- `BackButton` / `ConfirmBackButton` — la acción secundaria de "volver"
  debajo de una principal; la variante `Confirm` pide confirmación antes de
  disparar (volver/terminar/reiniciar).
- `LeaveToLobbyButton` — la salida online de "volver al lobby" (mid-ronda/
  resultado).

## Si necesitás cambiar algo

- ¿Se ve mal en todas las pantallas a la vez? Probablemente sea uno de estos
  archivos.
- ¿Se ve mal solo en la pantalla de un juego? Fijate primero en la carpeta
  `components/` propia de ese juego — probablemente no sea compartido.
