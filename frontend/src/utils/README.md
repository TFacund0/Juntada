# Utils compartidos

Helpers puros (sin JSX, sin hooks de React) usados por más de una parte de la
app. La convención tiene tres capas, cada una scopeada a su propio nivel:

- **`src/utils/`** (esta carpeta) — helpers cross-feature: cosas que no le
  pertenecen a un juego ni a una feature en particular porque las usa (o
  podría usarlas) cualquiera de ellos.
- **`features/*/utils/`** (ej. `features/multiplayer/utils/`) — helpers
  scopeados a esa feature, usados por más de un componente/hook dentro de
  ella pero sin sentido fuera de ese dominio.
- **`games/*/utils/`** — helpers scopeados a un juego puntual, usados por más
  de una pantalla/componente de ese juego pero irrelevantes para el resto de
  la app.

Regla simple para decidir dónde va algo nuevo: si sólo lo usa un juego o una
feature, no pertenece acá — va en `games/<juego>/utils/` o
`features/<feature>/utils/` respectivamente. Sólo sube a `src/utils/` cuando
lo necesitan dos o más juegos/features, o el propio `App.tsx`/shell.

## Contenido actual

- **`nextPlayerName.ts`** — siguiente nombre por defecto para un jugador
  nuevo en cualquier lista de jugadores (ej. "Jugador 3").
- **`localFlag.ts`** — helper de bandera/flag para modo local.
- **`appActivity.ts`** — store a nivel módulo (no hook) que trackea si la app
  está "en juego" en este momento; lo consume tanto `App.tsx` como
  `useServiceWorkerUpdate` para no forzar una actualización de la PWA en
  medio de una partida.

Cada archivo trae su `.test.ts` colocado al lado — esa es la convención acá,
no una carpeta `__tests__/` separada.
