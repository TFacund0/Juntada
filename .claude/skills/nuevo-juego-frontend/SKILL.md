---
name: nuevo-juego-frontend
description: Aplica las convenciones de arquitectura de Juntada (frontend/src/games/) a un juego nuevo o en desarrollo — separación UI/estado/reglas, reutilización de game-kit y ui, extracción de lógica pura a packages/, arquitectura por feature, y tests con Vitest. Usar SIEMPRE que el usuario esté creando, agregando, terminando o revisando un juego nuevo del frontend (menciones como "agregué un juego", "estoy armando el juego X", "quiero sumar un minijuego", "revisá este juego nuevo", o cuando se ve un directorio nuevo bajo frontend/src/games/ con código sin tests o sin la estructura habitual), incluso si el usuario no pide explícitamente "buenas prácticas" o "refactor".
---

# Nuevo juego en el frontend de Juntada

Este skill guía la incorporación de un juego nuevo a `frontend/src/games/` para que quede
consistente con el resto del repo. La motivación no es dogma arquitectónico: Juntada ya tiene
~25 juegos con la misma forma, y cuando un juego nuevo la rompe, se vuelve más caro de mantener,
más difícil de testear, y sus componentes reutilizables no benefician a los juegos futuros. Seguir
el patrón existente es lo que hace que agregar el juego #26 siga siendo barato.

Usa `frontend/src/games/rayado-libre/` como referencia viva de "cómo se ve un juego bien
organizado en este repo" — es el ejemplo más completo y reciente. Cuando tengas dudas de
estructura, mirá cómo lo resolvió ese juego (o `tutifruti`, `sintonia`, `color-correcto` si el
juego nuevo tiene lógica online).

## Flujo de trabajo

1. **Ubicar el juego nuevo.** Identificá la carpeta bajo `frontend/src/games/<nombre-juego>/`
   (y su contraparte `backend/src/games/<nombre-juego>/` si el juego tiene modo online).
2. **Revisar contra cada uno de los cuatro chequeos de abajo**, en este orden: arquitectura de
   carpetas primero (da contexto para todo lo demás), después SoC, después DRY/reutilización,
   después tests.
3. **Actuar, no solo señalar.** Cuando detectes una violación, aplicá la corrección vos mismo
   (mover archivos, extraer un hook, reemplazar un componente casero por uno de `game-kit`,
   escribir el test faltante) en vez de dejar una lista de sugerencias. Si una corrección es
   grande o ambigua (p. ej. "esto debería ser un package nuevo"), explicá el trade-off y
   preguntá antes de reestructurar.
4. **Resumí al final** qué se reorganizó, qué se reutilizó y qué tests se agregaron — el usuario
   necesita saber qué cambió sin tener que releer todo el diff.

## 1. Arquitectura por feature

Cada juego vive enteramente bajo `frontend/src/games/<nombre-juego>/` con esta forma:

```
frontend/src/games/<nombre-juego>/
├── index.tsx           # entry point: arma el flujo del juego, importa las piezas
├── components/          # subcomponentes de presentación específicos del juego
├── types/                # tipos TypeScript locales al juego
├── utils/                # helpers puros (sin JSX) específicos del juego
├── tests/                # tests con Vitest, uno por componente/módulo relevante
├── assets/               # imágenes/recursos propios del juego (si aplica)
└── README.md             # opcional, documenta reglas del juego si no son obvias
```

Si el juego nuevo tiene todo el código en un solo archivo gigante en `index.tsx`, o mezcla
componentes sueltos directamente en `frontend/src/games/` sin las subcarpetas, reorganizalo
a esta forma. No hace falta que tenga las seis carpetas si el juego es simple (un juego de una
sola pantalla puede no necesitar `types/` propio), pero la carpeta `components/` y `tests/`
son casi siempre necesarias en cuanto el juego pasa de un componente.

Si el juego tiene modo online, confirmá que existe la carpeta simétrica en
`backend/src/games/<nombre-juego>/` con sus tests en `backend/test/<nombre-juego>/`. El proyecto
mantiene frontend y backend como pares nombrados igual — un juego online sin su carpeta backend
(o sin tests ahí) está incompleto.

## 2. Separación de responsabilidades (SoC)

Cada archivo debe tener un solo tipo de responsabilidad. Las tres capas que aparecen en todos
los juegos existentes:

- **Presentación** (`components/*.tsx`): recibe props, renderiza JSX, dispara callbacks. No
  decide reglas del juego ni calcula puntajes.
- **Orquestación** (`index.tsx`, contenedores tipo `LocalGame.tsx` / `RoundView.tsx` en
  rayado-libre): maneja el estado del juego (fases, turnos, timers), decide qué componente
  mostrar, conecta con el WebSocket si es online. Puede usar hooks locales para no explotar en
  tamaño.
- **Reglas/datos puros** (`utils/*.ts`, o un `packages/<juego>-*` si el juego lo justifica):
  funciones sin JSX ni estado de React — cálculo de puntaje, validación de jugadas, generación
  de mazos/palabras. Son las más fáciles de testear en aislamiento y las candidatas a extraer a
  un package si otro juego pudiera reutilizarlas o si crecen lo suficiente como para merecer
  tests propios desacoplados de React (mirá `packages/rayado-libre-scoring`,
  `packages/tutifruti-words`, `packages/color-correcto-scoring` como precedentes).

Señal de alerta típica: un componente de `components/` que calcula puntajes, decide ganadores,
o contiene lógica de turnos inline en el JSX/handlers en vez de recibir esa decisión ya resuelta
por la capa de orquestación o por una función pura importada. Si ves eso, extraé esa lógica a
`utils/` (o proponé un package si aplica) y dejá el componente solo con el renderizado.

## 3. DRY y reutilización de componentes existentes

Antes de que el juego nuevo defina su propio botón de volver, timer, podio, contador de turno,
etc., consultá `references/game-kit-catalog.md` — tiene cada componente de `game-kit/` y `ui/`
con qué hace, sus props principales y cuándo usarlo. Es más rápido que releer cada archivo
fuente, pero si el catálogo no cubre el caso o parece desactualizado, andá al código real en:

- `frontend/src/components/game-kit/` — piezas específicas de la mecánica de juegos multiplayer:
  `BackButton`, `ConfirmBackButton`, `LeaveToLobbyButton`, `Timer`, `useCountdownSeconds`,
  `RevealCountdown`, `PhaseTransition`, `TurnCircle`, `TurnOrderEditor`, `PodiumBoard`,
  `AddPlayerForm`, `MinPlayersHint`, `Toggle`, `Collapsible`, `BigTextFlash`,
  `GameScreenLayout`.
- `frontend/src/components/ui/` — piezas genéricas de UI sin conocimiento del dominio de juegos:
  `Btn`, `Avatar`, `Spinner`, `Toast`, `ErrorBanner`, `ScreenFade`, `CodeDisplay`, `QRCode`,
  `icons`.

Si el juego necesita algo parecido pero no idéntico, preferí extender/parametrizar el componente
existente antes que duplicarlo con variaciones menores.

En la dirección inversa: si mientras armás el juego nuevo escribís un componente que no tiene
nada específico de ese juego (por ejemplo, otro tipo de contador, otro layout de resultado final,
otro selector de categorías genérico), consideralo candidato a promover a `game-kit/` o `ui/` en
vez de dejarlo enterrado en `games/<nombre-juego>/components/`. Solo hacelo si genuinamente no
tiene lógica atada a ese juego particular — si tenés dudas, dejalo local y mencionaselo al
usuario como sugerencia en vez de moverlo vos mismo.

## 4. Tests

El proyecto testea con Vitest + jsdom (`frontend/vitest.config.ts`,
`frontend/src/test/setup.ts`). Para lógica que involucra WebSocket/modo online, hay un mock
listo en `frontend/src/test/mockWebSocket.ts` — usalo en vez de armar un mock nuevo.

- Los tests del juego van en `frontend/src/games/<nombre-juego>/tests/*.test.tsx`, uno por
  componente/módulo con lógica no trivial (no hace falta testear componentes puramente
  decorativos sin ramas condicionales). Mirá `rayado-libre/tests/` como plantilla de estilo
  (nombre de archivo espejo del componente, `describe`/`it` en español o inglés según lo que ya
  uses en el resto del juego — seguí la convención del propio juego si ya escribiste algo).
- Priorizá testear la capa de reglas puras (`utils/`) primero — son las más baratas de testear y
  las que más rompen sin darse cuenta. Después los contenedores de orquestación (fases, turnos).
  Los componentes puramente visuales son opcionales.
- Si el juego tiene backend, verificá que `backend/test/<nombre-juego>/` exista con cobertura
  simétrica a la lógica de servidor.

## 5. Antes de dar el trabajo por terminado

No alcanza con que el código "compile" — antes de cerrar la tarea, corré (y dejá en verde) todo
lo que este repo exige como estándar (ver `.claude/skills/CLAUDE.md`), no solo los tests del
juego:

- `pnpm lint`
- `pnpm format:check` (si encuentra diffs de formato, corré `pnpm format` para aplicarlos —
  Prettier, no a mano)
- `pnpm --filter @juntada/frontend typecheck` (y `@juntada/backend typecheck` si tocaste
  backend)
- Los tests unitarios del juego (y de cualquier package que hayas tocado)
- `pnpm test:e2e` si el juego nuevo agrega o cambia navegación/flujo multiplayer end-to-end

Si aparece un warning o error preexistente que no tiene que ver con el juego que estás tocando,
no lo arregles de paso — mencionáselo al usuario en el resumen final en vez de mezclarlo en el
mismo cambio.

## 6. Mantenibilidad general

- Nombres de componentes descriptivos de lo que muestran, no de dónde están (`WordChoiceFan`,
  no `Component3`).
- Si un archivo de `components/` supera unas ~200 líneas o mezcla más de una responsabilidad
  visual, dividilo — rayado-libre tiene ~25 archivos en `components/` precisamente por esto,
  ningún archivo individual carga con toda la pantalla.
- Evitá prop drilling de más de 2-3 niveles; si varios componentes anidados necesitan el mismo
  estado, subilo a un hook local en el contenedor de orquestación en vez de pasarlo prop por
  prop.
- Tipar todo con TypeScript. Tipos específicos del juego van en `types/` local; si un tipo
  necesita compartirse entre frontend y backend o entre juegos, va en `packages/shared-types`.
