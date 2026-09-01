# Hooks compartidos

Hooks de React usados por `App.tsx` y/o por más de un juego/feature. Todo lo
que solo usa un juego en sus propias pantallas vive dentro de la carpeta de
ese juego (ej. `games/impostor/hooks/`), y `features/multiplayer/hooks/`
tiene el propio del shell multijugador (`useMultiplayerSocket`). Los dos
módulos no-hook que antes vivían acá (`appRoutes.ts`, `appActivity.ts`) se
mudaron a `../routing/` y `../utils/` respectivamente — acá sólo quedan
hooks de React de verdad, organizados en subcarpetas por dominio.

## `session/` — qué se está jugando y quién sos

- **`useAppSession.ts`** — qué juego/modo está elegido y el flujo de grupo;
  extraído de lo que antes era `useAppNavigation.ts` (misma lógica, mismo
  comportamiento). No conoce confirmaciones/diálogos ni la cortina de
  transición; eso vive en `navigation/useAppDialogs`/`ui/useHeaderUI` y
  `navigation/useAppShell` respectivamente. Lee el esquema de URL desde
  `../../routing/appRoutes.ts` (`routeInitFromMatches`) para derivar el
  estado inicial en una carga directa o un refresh.
- **`useActiveSession.ts`** — recuerda qué juego/modo estaba activo
  (`sessionStorage`) para que un navegador mobile que descarta la página
  entera estando en segundo plano vuelva a esa misma pantalla en vez de al
  selector de juegos. (El consumo del link de unión escaneado/compartido,
  que sí conoce multijugador, vive en
  `features/multiplayer/hooks/useValidJoinLink.ts`, no acá.)
- **`usePlayerName.ts`** — el nombre del jugador, extraído de `App.tsx`. Se
  pregunta una sola vez (`NameOnboardingScreen`) y queda guardado localmente
  (vía `features/multiplayer/utils/playerName.ts`) para que nada más
  adelante tenga que volver a pedirlo; editable después desde la pantalla de
  inicio.

## `navigation/` — moverse entre pantallas/pasos

- **`useAppDialogs.ts`** — estado de las confirmaciones reales de
  "volver"/"salir", también extraído de `useAppNavigation.ts`. Los toggles
  del header (profile menu / rules) NO viven acá, ver `ui/useHeaderUI.ts`.
- **`useBackNavigation.ts`** — la lógica de "volver" propiamente dicha:
  decide, según en qué paso/modo esté el jugador, si hace falta confirmar,
  a qué pantalla vuelve y si hay que limpiar la sesión de multijugador.
- **`useUrlSync.ts`** — mantiene la barra de direcciones sincronizada con el
  estado de navegación (`buildPath` de `../../routing/appRoutes.ts`) y evita
  que el back/forward del navegador tire progreso a mitad de una ronda
  (pushea un checkpoint extra cuando `midRound` se vuelve true).
- **`useStepTransition.ts`** — la cortina de transición (fundido a negro
  entre juegos con tema propio) y `stepKey`/`stepDirection` (qué "paso" de
  arriba está en pantalla, y si el cambio hacia ese paso se siente como ir
  "para adelante" o "para atrás") — extraído tal cual de
  `useAppNavigation.ts`. Delega el fundido en sí a `ui/useCurtainTransition.ts`.
- **`useAppShell.ts`** — composition root: NO es un wrapper que re-expone
  los hooks hoja (eso ya lo hace `App.tsx` llamándolos directo). Sólo
  implementa las acciones que de verdad cruzan varios de ellos a la vez
  (`goHome`, `pickGame`, `startGroupFlow`, `confirmGoBack`), mutando estado
  de sesión + curtain + header simultáneamente — extraídas tal cual de
  `useAppNavigation.ts`, sólo que ahora reciben el estado/setters de los
  hooks hoja ya instanciados por `App.tsx` en vez de volver a llamarlos.
- **`useGameBridgeRefs.ts`** — refs imperativos que "exponen" acciones desde
  los componentes de juego hacia arriba (header / diálogos globales) sin
  levantar todo su estado a `App` — extraído tal cual de
  `useAppNavigation.ts`.
- **`useAppContextValues.ts`** — arma los 5 valores de contexto por dominio
  (`pages/context/`) que `AppMainContent` provee alrededor del `<Outlet>` de
  React Router, combinando `useAppSession`, `useGameBridgeRefs`,
  `useStepTransition` y `useAppShell` ya instanciados. Cada slice se memoiza
  por separado, así una página que solo lee `GameSessionContext` no
  re-renderiza cuando cambia, por ejemplo, `CurtainContext`.

## `ui/` — chrome visual reusable

- **`useHeaderUI.ts`** — toggles de UI del header (dropdown de perfil /
  reglas), extraído de `useAppNavigation.ts`. Separado de
  `navigation/useAppDialogs` porque no son confirmaciones, son simples
  toggles de visibilidad. Usa `useClickOutside.ts` para cerrar el dropdown.
- **`useDevNotice.ts`** — el aviso único de "app en desarrollo"
  (`DevNoticeDialog`), extraído de `App.tsx`. Dueño de la bandera
  `impostorgame:devNoticeSeen` (vía `../../utils/localFlag.ts`):
  `dismissDevNotice` la persiste para que no vuelva a aparecer en ese
  dispositivo.
- **`useCurtainTransition.ts`** — el fundido a negro que se reproduce al
  entrar/salir de un juego con tema propio, para que el cambio de paleta de
  toda la app pase tapado en vez de como un corte brusco. Reservado a juegos
  con tema propio a propósito: la pantalla de destino ya reproduce su propia
  entrada vía `<ScreenFade>`, así que sumar esta cortina para _todo_ juego
  hacía que las dos animaciones corrieran pisadas (ver el comentario del
  archivo). Dos variantes: `withCurtain` (acciones locales instantáneas) y
  `withAsyncCurtain` (crear/unirse online, que espera un viaje de ida y
  vuelta al servidor antes de levantar la cortina).
- **`useGameTheme.ts`** — calcula el reskin de toda la app (ver `gameTheme`
  en `GameDef`, `theme/gameThemes.ts`) para el juego que esté en pantalla,
  setea las variables `--jt-*` (`theme/sharedChrome.css`) en `<html>` (no en
  el div raíz de `App.tsx`, para que también las herede cualquier
  componente compartido portado a `document.body`), y mantiene
  sincronizados el fondo del `<body>` y el meta tag `theme-color` con ese
  tema.
- **`useFlashError.ts`** — un mensaje de error/validación transitorio:
  setearlo incrementa una `key` (para que la animación de destello de
  `ErrorBanner` se repita incluso con un mensaje idéntico repetido) y se
  auto-limpia después de una duración. Reutilizado por cualquier cosa que
  muestre un error temporal (ver `features/multiplayer/hooks/
useMultiplayerSocket.ts`, `NamePillEditor`, ...) en vez de que cada uno
  reimplemente su propia lógica de timeout.
- **`useClickOutside.ts`** — compartido por cada dropdown/panel que se
  cierra al clickear afuera (profile menu, group menu, el trigger mobile
  propio de `GroupMenuDropdown`) — cada uno antes reimplementaba a mano el
  mismo listener de mousedown + cleanup. `onOutside` se lee vía ref para que
  quien lo llama pueda pasar una arrow inline sin que eso resuscriba el
  listener en cada render.
- **`useCopyToClipboard.ts`** — compartido por cada affordance de "tocar
  para copiar, mostrar 'Copiado' un momento" (código de sala/grupo, link de
  invitación, el copy de fallback del diálogo QR) — cada uno antes repetía a
  mano la misma escritura al clipboard + flag temporizado de "copiado".

## `device/` — capacidades del dispositivo/navegador

- **`useServiceWorkerUpdate.ts`** — el `registerType: "autoUpdate"` de la
  PWA (ver `vite.config.ts`) sólo chequea un `sw.js` nuevo en la navegación
  — una pestaña dejada abierta un rato (típico a mitad de partida) nunca se
  entera sola. Este hook hace polling de `registration.update()` en su
  lugar, y consulta `../../utils/appActivity.ts` para no forzar la
  actualización mientras hay una partida en curso.

## Si necesitás cambiar algo

Un hook acá debería seguir siendo utilizable por _cualquier_ juego/pantalla,
no solo por el que justo lo necesita ahora — si una lógica es realmente
específica de un juego o una pantalla, probablemente vaya al lado de esa
pantalla y no acá.
