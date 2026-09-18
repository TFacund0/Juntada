# Games (contrato entre juegos)

Este `README.md` de nivel superior cubre solo los tres archivos que están
_por encima_ de cada juego individual — `gameTypes.ts`, `registry.ts`,
`maintenance.ts`. La carpeta propia de cada juego (`games/<id>/`) tiene su
propia estructura interna y queda fuera de alcance acá; la reorganización
por juego se sigue por separado (ver `docs/REORGANIZACION_JUEGOS.md` en la
raíz del repo).

- **`gameTypes.ts`** — `GameDef`, el contrato que debe cumplir el
  `index.tsx` de cada juego (id, label, componentes `LocalGame`/
  `ConfigPanel`/`RoundView`/`LobbyInfo`, `rules`, `gameTheme` opcional, ...).
  Cada campo tiene su propio comentario explicando para qué sirve y cuándo
  hace falta — léelo de punta a punta antes de agregar un juego nuevo o una
  capacidad nueva a `GameDef` mismo.
- **`registry.ts`** — `GAMES`/`GAME_LIST`/`getGame()`: el único lugar donde
  se enchufa cada juego. Agregar un juego significa crear `games/<id>/` con
  las piezas que pide `GameDef` y sumar un import + una entrada acá — el
  shell de la app (`App.tsx`, `MultiplayerGame.tsx`, `useMultiplayerSocket.ts`)
  nunca necesita cambiar.
- **`maintenance.ts`** — `isUnderMaintenance()`, el gate para un juego
  marcado `maintenance: true` (ya lanzado, bloqueado temporalmente mientras
  se lo retrabaja — distinto de `comingSoon`, que nunca se lanzó todavía).

## Si necesitás cambiar algo

- ¿Agregar un juego nuevo? → `registry.ts` (un import, una entrada), más lo
  que pida `gameTypes.ts` de un `GameDef`.
- ¿Agregar una capacidad nueva que cualquier juego _podría_ adoptar (como
  fueron `gameTheme` o `tabbedLobby`)? → un campo opcional nuevo en
  `GameDef` dentro de `gameTypes.ts`, con un comentario explicando qué hace
  y cuándo usarlo.
- ¿Bloquear/desbloquear un juego ya lanzado? → `maintenance: true`/`false`
  en el `GameDef` propio de ese juego, en `games/<id>/index.tsx`, no acá.

## Convención dentro de cada `games/<id>/` (vigente, no divergir)

Esto aplica parejo a los doce juegos, no es opcional por juego:

- **Tests en `__tests__/`** — carpeta hermana dentro del mismo directorio
  que la fuente que testean (`components/__tests__/LobbyInfo.test.tsx`
  para `components/LobbyInfo.tsx`, `__tests__/LocalGame.test.tsx` para
  `LocalGame.tsx`, etc.). Nunca co-ubicados sueltos junto al archivo
  fuente, y nunca en una carpeta `tests/` separada del padre — ambas
  variantes quedaron obsoletas (ver `docs/REORGANIZACION_JUEGOS.md` para
  el historial).
- **Archivos de rol único van en `components/`** — `ConfigPanel.tsx`,
  `LobbyInfo.tsx` y cualquier otra pieza de UI con un solo rol claro son
  componentes como cualquier otro; nunca sueltos en la raíz del juego solo
  porque son "el panel de config" o "la info del lobby".
- **Tipos en `types/`, un archivo por rol** — por ejemplo `localGame.ts`
  para el estado del modo local, `roundView.ts` para el modo online. No
  amontonar todos los tipos del juego en un solo archivo ni dejarlos
  sueltos en la raíz.
- **CSS múltiple en `css/`, con un barril `css/index.css` si hace falta
  uno** — nunca un `.css` suelto en la raíz del juego conviviendo con la
  carpeta `css/` (o es todo barril + secciones adentro de `css/`, o es un
  único archivo en la raíz; no las dos cosas a la vez).
