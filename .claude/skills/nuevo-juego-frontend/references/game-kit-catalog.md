# Catálogo de componentes reutilizables

Generado a partir del código en `frontend/src/components/game-kit/` y `frontend/src/components/ui/`.
Si agregás, quitás o cambiás la firma de un componente en esas carpetas, actualizá este catálogo.

Antes de escribir un componente nuevo para un juego, revisá si algo de acá ya resuelve el caso.

## game-kit (componentes específicos de juegos multiplayer)

### GameScreenLayout

Layout de 3 zonas (`top`/`center`/`bottom`) que se repite en toda pantalla jugable, más una zona opcional `stickyBottom` fijada al viewport (usa `StickyActionBar` internamente y agrega el padding necesario).

- Props: `top?: ReactNode`, `center: ReactNode`, `bottom?: ReactNode`, `stickyBottom?: ReactNode`, `className?: string`, `style?: CSSProperties`.
- Cuándo usarlo: como esqueleto de cualquier `RoundView`/pantalla de juego que necesite separar contexto (timer/turno), contenido principal y acciones, con o sin una acción principal fija abajo del todo.

### PhaseTransition

Envuelve el contenido de una fase con un fade-in + slide-up (`0.25s`); al usar `phaseKey` como `key` fuerza remount y repite la animación en cada cambio de fase.

- Props: `phaseKey: string`, `children: ReactNode`.
- Cuándo usarlo: alrededor de cada fase de `RoundView`/`LocalGame` para que el cambio de fase se sienta como transición en vez de corte instantáneo.

### LeaveToLobbyButton

Botón de "Volver al lobby" para partidas online (se oculta si el jugador está dentro de un grupo, ya que ahí el link persistente del shell cubre ese caso), con confirmación incluida vía `ConfirmBackButton`.

- Props: `groupCode: string | null`, `send: (msg: { type: string }) => void`, `message?: string` (default ya cubre el caso genérico).
- Cuándo usarlo: en pantallas de resultado/mitad de ronda online, para disparar `back_to_lobby` con confirmación, sin reescribir el texto default salvo que el juego difiera (ej. sin puntaje persistente).

### Collapsible

`S.card` que arranca colapsada mostrando solo el título, con flecha que rota al abrir.

- Props: `title: string`, `defaultOpen?: boolean`, `children: ReactNode`.
- Cuándo usarlo: para información secundaria (puntos de ronda, tablas de posiciones) que saturaría la pantalla si estuviera siempre visible.

### ComingSoon

Placeholder de "juego en construcción" para juegos ya registrados en el picker pero sin implementar.

- Props: `label?: string`.
- Cuándo usarlo: como componente de un juego todavía no implementado en `games/registry.ts`.

### MinPlayersHint

Aviso "Necesitás mínimo N jugadores"; no renderiza nada si ya se cumple el mínimo.

- Props: `count: number`, `min: number`.
- Cuándo usarlo: debajo de un botón de arranque deshabilitado por falta de jugadores — se puede poner incondicionalmente sin chequear el mínimo antes.

### RevealCountdown (+ hook `useRevealCountdown`)

Cuenta regresiva visual grande antes de mostrar el resultado de una ronda. El hook `useRevealCountdown(resetKey, seconds = 3)` maneja el estado/reinicio sincronizado con `resetKey`; el componente `RevealCountdown({ count, label })` solo pinta el número.

- Props del componente: `count: number`, `label?: string`. Props del hook: `resetKey: unknown`, `seconds?: number`.
- Cuándo usarlo: cuando el desenlace de una ronda necesita un momento de suspenso en vez de mostrarse apenas cambia la fase; `resetKey` debe cambiar una vez por resultado nuevo (ej. `room.roundHistory.length`).

### BackButton

Botón secundario "volver" con estilo ghost y margen superior estándar.

- Props: `children: string`, `onClick: () => void`.
- Cuándo usarlo: como acción secundaria de "volver al setup/lobby" debajo de la principal, en pantallas de resultado/juego (local u online).

### AddPlayerForm

Card de "sumar jugador": input + botón "Sumar" + `ErrorBanner` inline. No valida ni deduplica nombres — eso queda del lado de quien lo usa.

- Props: `name: string`, `onNameChange: (value: string) => void`, `onSubmit: () => void`, `error: string`, `errorKey: number`.
- Cuándo usarlo: en cualquier setup de modo local que arme su propia lista de jugadores.

### ConfirmBackButton

`BackButton` que antes de disparar `onConfirm` abre un `ConfirmDialog`.

- Props: `children: string`, `title: string`, `message: string`, `confirmLabel?: string`, `onConfirm: () => void`.
- Cuándo usarlo: para acciones medio destructivas de "salir/terminar/reiniciar" (volver al lobby, terminar partida local) al pie de una pantalla de resultado, en vez de reimplementar diálogo + estado booleano.

### TurnCircle

Círculo de jugadores en orden de turno; el jugador actual brilla, los que ya jugaron quedan atenuados con tilde, y soporta un estado opcional `outcomes` por jugador (`solved`/`eliminated`/`conceded`) para juegos donde alguien sale de la rotación a mitad de ronda. Escala tamaño/spacing según cantidad de jugadores.

- Props: `turnOrder: string[]`, `turnIndex: number`, `players: { id, name, online? }[]`, `meId: string | undefined`, `outcomes?: Record<string, "solved"|"eliminated"|"conceded">`.
- Cuándo usarlo: en cualquier juego por turnos que necesite mostrar visualmente a quién le toca (usado por Impostor y ¿Quién Soy?, online y local pasa-y-juega).

### Toggle

Switch on/off controlado, con label propio, sin estado interno.

- Props: `label: string`, `value: boolean`, `onChange: (value: boolean) => void`.
- Cuándo usarlo: para cualquier opción booleana de configuración con label visible.

### TurnOrderEditor (+ función `resolveTurnOrder`)

Editor de orden de turno exclusivo del host: lista reordenable (avatar + nombre + ↑/↓), con toggle opcional azar/manual. `resolveTurnOrder(players, turnOrder)` reconcilia un orden guardado descartando jugadores que se fueron y agregando al final a los que se sumaron después; se exporta por separado porque la lógica de arranque de ronda de un juego puede necesitar la misma reconciliación.

- Props: `players: {id, name}[]`, `turnOrder: string[] | undefined`, `onChange: (order: string[]) => void`, `allowRandom?: boolean`, `label?: string`, `helpText?: string`, `bare?: boolean` (para no anidar card dentro de card).
- Cuándo usarlo: en el `ConfigPanel` de un juego por turnos donde el host define/ajusta el orden (usado en ¿Quién Soy? y Limón-Limón).

### BigTextFlash

Flash de pantalla completa opaco (no modal translúcido) con texto grande centrado y animación de aparición/desaparición (~1.4s).

- Props: `eyebrow?: string`, `text: string`.
- Cuándo usarlo: para momentos de "letras grandes" de transición que un juego quiere anunciar con toda la atención del grupo, sin que se filtre lo de atrás.

### useCountdownSeconds (+ función `timerUrgencyColor`)

Hook que tickea cada 500ms una cuenta regresiva propia a partir de un `timerEnd` de servidor (sin segundos tickeados localmente). `timerUrgencyColor(secondsLeft)` da el color por umbral de urgencia (rojo <15s, ámbar <30s, verde el resto).

- Props/params: `timerEnd: number`, `total?: number` → retorna `{ secs, total }`.
- Cuándo usarlo: para cualquier timer visual (barra o anillo) que solo tiene el timestamp de fin del servidor y necesita su propio tick local; usar `timerUrgencyColor` para colorear cualquier timer sin reimplementar el ternario de umbrales.

### Timer

Barra de progreso con cuenta regresiva memoizada (React.memo), con tick interno de 500ms.

- Props: `timerEnd: number`, `total?: number`, `label?: string`.
- Cuándo usarlo: como timer estándar de ronda dentro de un `RoundView` que se re-renderiza seguido por broadcasts de WS — el memo evita recalcular en cada re-render no relacionado.

### PodiumBoard

Pantalla de cierre de partida: podio de los primeros 3 puestos (barras con altura/color por puesto + confetti + animación de subida) más card "Resto de la tabla" para el resto. Usa el tipo compartido `ScoreboardEntry` (`id`, `name`, `score`, `roundPoints?`, `isMe?`).

- Props: `entries: ScoreboardEntry[]`, `colors?: [string, string, string]` (default oro/plata/bronce).
- Cuándo usarlo: en la pantalla final de cualquier juego con puntaje acumulado; para una tabla de posiciones intermedia (no de cierre) usar `Scoreboard` en su lugar, que cada juego mantiene por separado.

## ui (componentes genéricos)

### Btn

Único componente de botón de la app; centraliza las 4 variantes visuales (`primary`, `success`, `danger`, `ghost`) definidas en `S.btn`.

- Props: `children: ReactNode`, `onClick?`, `variant?: "primary"|"success"|"danger"|"ghost"`, `disabled?: boolean`, `style?`, `className?`.
- Cuándo usarlo: para cualquier botón de la app — cambiar el look de una variante se hace en `theme/styles.ts`, no en cada call site.

### ErrorBanner

Banner de error auto-limpiable por quien lo usa; `flashKey` fuerza un remount (vía `key`) para repetir la animación de destello aunque el mensaje sea idéntico al ya mostrado.

- Props: `message: string`, `flashKey: number`, `variant?: "block"|"inline"`.
- Cuándo usarlo: para mostrar cualquier error repetible en pantalla, tanto bloque como inline (ej. dentro de `AddPlayerForm`, `QRCode`).

### Spinner

Anillo giratorio genérico de carga.

- Props: `size?: number`.
- Cuándo usarlo: para cualquier estado de carga fuera de `SessionRecoveryOverlay` (que tiene su propio spinner/paleta), ej. fallback de `Suspense` al cargar el bundle de un juego.

### Toast

Banner breve auto-cerrable (ej. "X se desconectó"), portal a `document.body` para no quedar atrapado por transiciones `transform` de pantalla.

- Props: `message: string | null`, `duration?: number` (default 3000), `onExpire: () => void`.
- Cuándo usarlo: para notificaciones efímeras que el padre dispara cambiando `message`; no renderiza nada si no hay mensaje, así se puede montar incondicionalmente.

### ScreenFade

Fade-in liviano al cambiar de pantalla (remonta contenido cuando cambia `transitionKey`), alternativa más simple que la cortina completa (`useCurtainTransition`).

- Props: `transitionKey: string`, `direction?: "forward"|"back"`, `skipAnimation?: boolean`, `children: ReactNode`.
- Cuándo usarlo: para transiciones entre pantallas sin router propio de la app; `direction` solo lo necesita quien puede calcular ida/vuelta (ej. `App.tsx`).

### CodeDisplay

Visualización del código de sala/grupo, tocable para copiar al portapapeles (usa `useCopyToClipboard`). Modo `compact` (chip inline) o grande (card).

- Props: `code: string`, `compact?: boolean`, `label?: string` (default "SALA").
- Cuándo usarlo: en cualquier pantalla que muestre un código de sala o grupo para compartir.

### QRCode

Genera un QR de `value` en un `<canvas>`, enteramente client-side (sin llamada de red a un servicio externo).

- Props: `value: string`, `size?: number`.
- Cuándo usarlo: para compartir un link/código de sala como QR, sin filtrar datos a terceros ni depender de conexión.

### icons (CloseIcon, BackArrowIcon, ShareArrowIcon, PlusIcon, CrownIcon, UserMinusIcon, AlertIcon)

Set de íconos SVG inline estilo Feather (viewBox 24, stroke `currentColor`), cada uno con props `size?`, `color?`, `strokeWidth?`.

- Cuándo usarlo: para cualquier ícono de UI genérico (cerrar, volver, compartir, agregar, host/corona, expulsar, alerta) en vez de un glifo de texto o un SVG inline nuevo — un SVG con `display: block` centra bien en botones circulares, a diferencia de un glifo tipográfico.

### Avatar

Círculo con iniciales del nombre y color de fondo determinístico según la primera letra; memoizado.

- Props: `name: string`, `size?: number` (default 40).
- Cuándo usarlo: en cualquier lista de jugadores (sala/lobby/votación/podio/turnos) — memo evita re-renderizar toda la lista ante broadcasts de WS no relacionados.
