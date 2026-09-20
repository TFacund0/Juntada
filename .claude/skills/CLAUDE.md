# Instrucciones para trabajar en este repo

Este archivo se carga automáticamente en cada sesión — no hace falta repetir
estas reglas en el prompt. Para contexto de arquitectura/stack/juegos, ver
`README.md`; esto es sobre _cómo_ trabajar, no _qué_ es el proyecto.

## Estándares de ingeniería (siempre, no solo cuando se pida)

- **DRY**: si una misma lógica aparece en 2+ lugares, extraerla a una función/hook/componente compartido — no copiar y pegar. Antes de escribir código nuevo, buscar si ya existe algo reutilizable (grep/glob primero, no asumir que hay que crear desde cero).
- **SoC (separación de responsabilidades)**: cada archivo/función tiene una responsabilidad clara. No mezclar lógica de negocio con presentación, ni estado de UI con lógica de red. Si un archivo hace más de una cosa claramente distinta, es candidato a partirse.
- **Modularización y reutilización**: preferir piezas chicas y componibles sobre archivos gigantes. No crear abstracciones especulativas para casos hipotéticos — extraer cuando hay duplicación real, no antes (YAGNI).
  - Umbral de referencia: un componente/archivo que supera ~150-200 líneas, o que mezcla más de una responsabilidad visual/lógica claramente distinta, es candidato a partirse — no esperar a que el usuario lo pida.
  - Antes de dar una tarea por terminada, releer los archivos que se crearon o crecieron y preguntarse: "¿este archivo hace una sola cosa?" y "¿alguna parte de esto ya podría vivir en su propio componente/hook/función?". Si la respuesta es dudosa, partirlo — es más barato modularizar al escribir que refactorizar después.
  - Esto aplica a todo el código generado, no solo a los juegos (routing, layouts, hooks compartidos, backend).
- **Nombres y comentarios**: nombres que expliquen el qué; comentarios solo para el _por qué_ no obvio (una decisión, un trade-off, una restricción oculta) — no comentarios que repitan lo que el código ya dice.
- **No over-engineering**: la solución más simple que resuelve el problema real gana. No agregar flags, configuración o capas de abstracción "por si acaso".

## Organización de archivos y carpetas

- **Frontend es feature-based**: cada juego vive en `frontend/src/games/<id>/` con su propia estructura interna (`components/`, `hooks/`, `utils/`, `css/`, `tests/`) — ver `docs/REORGANIZACION_JUEGOS.md` para el criterio completo y el estado de reorganización por juego. `frontend/src/features/multiplayer/` sigue el mismo criterio para todo lo de salas/grupos/red.
- Lo que es genuinamente compartido entre features (`frontend/src/components/`, `frontend/src/hooks/`) va ahí — pero solo si lo usan 2+ features reales, no preventivamente. Cada una de esas carpetas tiene su propio `README.md` explicando el criterio de qué va ahí.
- Antes de crear un archivo nuevo, ubicarlo donde correspondería si el proyecto ya estuviera "terminado" — no en la raíz de `src/` "por ahora".
- Backend separa infraestructura (`http/`, `ws/`, `state/`) de reglas de negocio (`games/<id>/`, `rooms/`) — mantener esa frontera al agregar código nuevo.

## Tests

- Cambios de comportamiento (no solo refactors) necesitan test — unitario si la lógica es aislable, E2E (`e2e/`, Playwright) si el flujo cruza UI+red y es user-facing.
- Antes de dar un cambio por terminado, correr: `pnpm lint`, `pnpm format:check`, `pnpm --filter @juntada/frontend typecheck`, `pnpm --filter @juntada/backend typecheck`, los tests unitarios de los paquetes tocados, y `pnpm test:e2e` si se tocó navegación/flujo multiplayer. Todo debe quedar en verde, no solo "compila".
- Si aparece un warning/error preexistente no relacionado al cambio actual, no arreglarlo de paso salvo que se pida explícitamente — mencionarlo, no mezclarlo en el mismo commit.

## Verificación real, no solo tests automatizados

- Para cambios de UI/navegación, probar en el navegador (Claude in Chrome) además de correr los tests — varios bugs reales de esta sesión (interceptar el botón atrás, pérdida de join links con StrictMode) solo aparecieron probando a mano, no en lint/typecheck/tests.
- No asumir que algo "ya está resuelto" o "hace falta" sin verificarlo en el código primero (ver el caso del code-splitting: ya estaba hecho, evitó trabajo innecesario).

## Flujo de trabajo

- Cambios no triviales (nueva feature, multi-archivo, decisión de arquitectura): plan mode primero, no directo a código.
- Nunca commitear sin que el usuario lo pida explícitamente. Nunca hacer `push` sin que se pida explícitamente.

### Commits

- **Sin co-author** — nunca agregar `Co-Authored-By` (a diferencia del comportamiento por defecto).
- **Conventional commits, en español**: `<tipo>(<scope opcional>): <resumen en español, minúscula, sin punto final>` — tipos: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `chore`. Ver `git log` para ejemplos reales ya usados en este repo.
- El cuerpo del commit (si hace falta) explica el _por qué_, no repite el diff línea por línea — en español, igual que el resumen.

### Pull requests (a `staging` o `main`)

- Mismo criterio que los commits: **profesionales, conventional, en español**. Título corto siguiendo el mismo formato `tipo(scope): resumen`; cuerpo con el template de `.github/pull_request_template.md` (Descripción / Tipo de cambio / Checklist), todo en español.
- La sección "Checklist" del template debe reflejar lo que realmente se verificó (lint, typecheck, tests, docs) — no tildarlo de memoria, y además todo tiene que ser en markdown.
- Igual que los commits: nunca abrir una PR sin que el usuario lo pida explícitamente.
