---
name: frontend-deuda-tecnica
description: Detecta y corrige deuda técnica estructural en frontend/src — CSS inline o .css dedicado sin Tailwind, tokens de color repetidos sin nombrar en @theme, juegos sin lógica extraída a packages/, packages sin tests, imports cruzados entre juegos, esqueleto de juego inconsistente, layout no responsive. Usar SIEMPRE que se toque un archivo de frontend/src/games/ o frontend/src/components/ (nuevo o existente), incluso si el pedido no menciona "buenas prácticas" o "refactor" — migrar de paso lo que se toca, no solo lo nuevo.
---

# Deuda técnica estructural del frontend — Juntada

Auditoría de 2026-08-31 encontró 6 gaps estructurales en `frontend/src` que las reglas
generales de `.claude/skills/CLAUDE.md` (DRY, SoC, modularización) no cubren porque son
específicos de decisiones de este repo. Esta skill los detecta y corrige — de forma gradual,
no con una migración masiva de una sola vez: **si tu cambio ya toca un archivo que viola una
de estas reglas, corregilo ahí mismo**; no vayas a buscar violaciones en archivos que no ibas
a tocar igual.

## Los 6 gaps (por prioridad de impacto)

### 1. CSS inline → Tailwind

172 archivos usan `style={{...}}` con el objeto `S` de `theme/styles` en vez de clases.
Decisión tomada: la solución estándar es **Tailwind** (no CSS Modules, no styled-components).

- Código nuevo: usar clases de Tailwind directamente en el JSX, nunca `style={{}}`.
- Si Tailwind todavía no está instalado/configurado en el proyecto, es el primer paso antes de
  escribir la primera clase — instalar, configurar `tailwind.config` y el entry CSS, y
  confirmarlo con el usuario antes de tocar `theme/styles` (afecta a todo el proyecto).
- Archivo legacy que tu cambio ya toca: migrá ese archivo completo de `style={{}}` a Tailwind
  como parte del mismo commit, no dejes una mezcla de ambos estilos en el mismo componente.
- No migres archivos que no ibas a tocar — la migración es gradual, archivo por archivo, atada
  a trabajo real.
- **También aplica a `.css` dedicado por componente** (ej. `AppHeader.css`, `HomeNavbar.css`,
  `GroupMenuDropdown.css`, `ProfilePanel.css` antes de migrarse) con clases BEM (`jt-*`) — no
  usan `style={{}}` con `S`, así que no entraron en el inventario original de 172 archivos, pero
  van contra la misma decisión de fondo ("Tailwind, no CSS Modules, no styled-components"). Si tu
  cambio ya toca uno de estos archivos, migralo a clases de Tailwind en el JSX y borrá el `.css`,
  mismo criterio que el resto de este gap (ver `frontend/src/components/shell/ProfilePanel.tsx`
  como referencia de la migración ya hecha).
  - Excepción: keyframes de animación compartidos entre varios componentes (ej. `jt-dropdown-in`
    en `theme/sharedChrome.css`) siguen viviendo en CSS global — Tailwind los invoca vía
    `animate-[nombre-del-keyframe_...]` arbitrario en vez de duplicar la definición.
- **Tokens de tema repetidos → nombrarlos en `@theme`**: este proyecto usa Tailwind v4
  (config-in-CSS, `@theme` en `frontend/src/theme/tailwind.css`, no `tailwind.config.js`). Hoy
  varios colores de tema se referencian como `var(--jt-accent,#7f77dd)`, `var(--jt-surface,#171329)`,
  etc. repetidos como clase arbitraria (`bg-[var(--jt-accent,...)]`) en archivo tras archivo. Es
  correcto seguir usando variables CSS para lo que cambia en runtime por juego/tema (Tailwind
  estático no puede generar clases dinámicas), pero repetir el `var(--jt-*, fallback)` completo en
  cada archivo es duplicación y propenso a typos.
  - Si tu cambio ya toca un archivo con 2+ usos de la misma variable de tema, agregá (o reusá) un
    token semántico en `@theme` de `theme/tailwind.css` (ej. `--color-jt-accent: var(--jt-accent,
#7f77dd);`) y usá la clase corta resultante (`bg-jt-accent`) en vez de repetir
    `bg-[var(--jt-accent,...)]`.
  - No migres de golpe todos los `var(--jt-*)` del proyecto — igual que el resto de este gap, es
    gradual y atado a archivos que ya estás tocando por otro motivo.

### 2. Juegos placeholder sin lógica extraída

17 de 28 juegos son solo `index.tsx` sin separar reglas de UI ni tests. Los juegos "maduros"
(sintonia, tateti, recamara, tutifruti) extraen su lógica pura a `packages/@juntada/*` (ej.
`sintonia-scoring`, `tateti-board`) sin dependencia de React, consumida desde `LocalGame.tsx`.

- Todo juego nuevo, o placeholder que completes, debe seguir ese mismo patrón: reglas puras a
  un package en `packages/`, UI en `LocalGame.tsx`/`components/`.
- Para el esqueleto de carpetas completo de un juego nuevo, usá la skill
  `nuevo-juego-frontend` — esta skill se enfoca en la extracción a packages y en no dejar
  lógica de negocio mezclada en el componente.

### 3. `packages/*` sin tests

La lógica de negocio pura extraída (la más barata de testear, sin React ni DOM) tiene 0
cobertura hoy.

- Todo package nuevo en `packages/` requiere tests unitarios desde el commit que lo crea, no
  después.
- Si tu cambio agrega funciones a un package existente, agregá el test correspondiente en el
  mismo cambio.

### 4. Imports cruzados entre juegos

No hay import boundaries en ESLint — nada impide que un juego importe directo de otro juego,
aunque hoy no se hace por convención.

- Regla: un juego solo puede importar de `components/`, `theme/`, `hooks/`, `utils/`
  compartidos a nivel raíz de `src/`, y de su propio `packages/@juntada/*`. Nunca de
  `frontend/src/games/<otro-juego>/`.
- Si mientras trabajás ves un import que rompe esto, corregilo (mové lo compartido a
  `components/`, `hooks/` o un package, según corresponda) en vez de dejarlo pasar.
- Si te piden agregar una regla ESLint de `no-restricted-imports` para forzar esto a nivel de
  todo el repo, es un cambio que afecta a todos los juegos — confirmá con el usuario antes de
  aplicarlo, no lo hagas de paso en un cambio de un juego puntual.

### 5. Esqueleto de juego inconsistente

Solo algunos juegos tienen `hooks/`, `utils/`, `types/` propios; no hay convención uniforme.

- Al completar o tocar un juego, alineá su esqueleto al de `rayado-libre/` o `tutifruti/`
  (referencia viva, ver `nuevo-juego-frontend`) en vez de inventar una estructura nueva.

### 6. Layout no responsive / mal aprovechado

Varias pantallas quedan con espacios vacíos grandes arriba, abajo o a los costados en vez de
adaptarse a la altura/ancho real del viewport — sobre todo en desktop o pantallas altas, donde
el diseño quedó pensado solo para el alto típico de un celular.

- Al migrar o tocar una pantalla, revisá que el contenido use el alto/ancho disponible en vez de
  quedar pegado arriba con todo el resto en blanco (`min-h-screen` / `h-full` en el contenedor
  raíz en vez de una altura fija, `flex flex-col` con el bloque principal creciendo vía `flex-1`
  en vez de alturas hardcodeadas).
- Probá el cambio en el navegador en al menos dos anchos (mobile ~390px y desktop ~1200px+), no
  solo en el viewport por defecto — un layout que se ve bien en uno puede dejar franjas vacías
  gigantes en el otro.
- No agregues breakpoints o reglas responsive por rutina donde el contenido ya se adapta bien
  (una card chica centrada no necesita reglas extra) — el objetivo es evitar espacio
  desperdiciado, no maximizar el uso de `sm:`/`md:`/`lg:` en todos lados.

## Flujo de trabajo

1. Identificá qué archivo(s) de `frontend/src/games/` o `frontend/src/components/` vas a tocar.
2. Revisá esos archivos contra los 6 gaps de arriba, en el orden en que están listados.
3. Corregí lo que encuentres en esos archivos — no busques violaciones en el resto del repo.
4. Si la corrección es grande o ambigua (instalar Tailwind, agregar regla ESLint global),
   explicá el trade-off y preguntá antes de aplicarla — afecta a más que tu cambio puntual.
5. Resumí al final qué se migró/corrigió y por qué, para que el usuario no tenga que releer
   todo el diff.
