# Hooks compartidos

Hooks de React usados por `App.tsx` y/o por más de un juego/feature. Todo lo
que solo usa un juego en sus propias pantallas vive dentro de la carpeta de
ese juego (ej. `games/impostor/hooks/`), y `features/multiplayer/hooks/`
tiene el propio del shell multijugador (`useMultiplayerSocket`).

- **`useActiveSession.ts`** — recuerda qué juego/modo estaba activo
  (`sessionStorage`) para que un navegador mobile que descarta la página
  entera estando en segundo plano vuelva a esa misma pantalla en vez de al
  selector de juegos. También tiene `useValidJoinLink()`, que consume un
  link de unión escaneado/compartido en la primera carga.
- **`useCurtainTransition.ts`** — el fundido a negro que se reproduce al
  entrar/salir de un juego con tema propio, para que el cambio de paleta de
  toda la app pase tapado en vez de como un corte brusco. Dos variantes:
  `withCurtain` (acciones locales instantáneas) y `withAsyncCurtain`
  (crear/unirse online, que espera un viaje de ida y vuelta al servidor
  antes de levantar la cortina).
- **`useFlashError.ts`** — un mensaje de error/validación transitorio:
  setearlo incrementa una `key` (para que la animación de destello de
  `ErrorBanner` se repita incluso con un mensaje idéntico repetido) y se
  auto-limpia después de una duración. Reutilizado por cualquier cosa que
  muestre un error temporal (ver `features/multiplayer/hooks/
useMultiplayerSocket.ts`, `NamePillEditor`, ...) en vez de que cada uno
  reimplemente su propia lógica de timeout.
- **`useGameTheme.ts`** — calcula el reskin de toda la app (ver `gameTheme`
  en `GameDef`, `theme/gameThemes.ts`) para el juego que esté en pantalla, y
  mantiene sincronizados el fondo del `<body>` y el meta tag `theme-color`
  con ese tema.

## Si necesitás cambiar algo

Un hook acá debería seguir siendo utilizable por _cualquier_ juego/pantalla,
no solo por el que justo lo necesita ahora — si una lógica es realmente
específica de un juego o una pantalla, probablemente vaya al lado de esa
pantalla y no acá.
