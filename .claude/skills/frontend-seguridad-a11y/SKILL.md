---
name: frontend-seguridad-a11y
description: Detecta y corrige riesgos de seguridad (XSS vía dangerouslySetInnerHTML, texto no escapado), accesibilidad (ARIA, foco, roles), memoización faltante en renders costosos, y `any` disperso pese a strict mode. Usar SIEMPRE que se toque un archivo de frontend/src (componente, hook, engine de juego) o backend/src/games/, incluso si el pedido no menciona "seguridad" o "accesibilidad" — corregir de paso lo que se toca, no solo lo nuevo.
---

# Seguridad, accesibilidad y performance del frontend — Juntada

Auditoría de 2026-08-31 encontró un XSS real (ya corregido, ver `packages/core-utils`
`escapeHtml` y su uso en `games/recamara`) y otros 4 gaps que no son bugs activos hoy pero
son la fuente más probable del próximo. Igual que `frontend-deuda-tecnica`, esta skill se
aplica de forma gradual: **si tu cambio ya toca un archivo con uno de estos gaps, corregilo
ahí mismo**; no vayas a buscar violaciones en archivos que no ibas a tocar igual.

## Los 4 gaps activos (por prioridad de impacto)

### 1. `dangerouslySetInnerHTML` con texto no confiable

Cualquier string que incluya datos que vengan de un jugador (nombre, mensaje de chat, texto
libre) y termine en `dangerouslySetInnerHTML` es un vector de XSS — ver el caso ya corregido
en `recamara` (`nameOf()` en `LocalGame.tsx` y `backend/src/games/recamara/engine.ts`).

- Antes de agregar o tocar un `dangerouslySetInnerHTML` nuevo, preguntate: ¿alguna parte de
  ese string viene de un jugador? Si sí, pasala por `escapeHtml` de `@juntada/core-utils`
  antes de interpolarla.
- Si el string es 100% estático (sin interpolación de datos de usuario), no hace falta
  escapar nada — no agregues esto por rutina donde no aplica.
- Si podés lograr el mismo resultado visual sin HTML crudo (JSX con `<b>` real en vez de
  string con `<b>`), preferí eso — es más seguro por diseño y no depende de que alguien
  recuerde escapar.

### 2. Accesibilidad (ARIA, foco, roles)

Solo ~18% de los componentes tienen algún atributo ARIA. `DialogFrame` (focus trap, roles,
cierre con Escape) es la referencia de cómo se ve bien hecho — no es la excepción, es el
objetivo para el resto.

- Todo elemento interactivo que no sea un `<button>`/`<a>` nativo (divs con `onClick`,
  cards clickeables) necesita `role` y soporte de teclado (`onKeyDown` para Enter/Space) o,
  mejor, convertirse en un `<button>` real.
- Modales/overlays nuevos: seguí el patrón de `DialogFrame` (focus trap al abrir, devolver
  foco al cerrar, `Escape` cierra, `role="dialog"` + `aria-modal`).
- Imágenes/iconos informativos: `alt` descriptivo; iconos puramente decorativos:
  `aria-hidden="true"`.
- No hace falta auditar accesibilidad de un componente que no estás tocando — aplicá esto
  a lo que tu cambio ya toca.

### 3. Memoización en renders costosos

Solo 8 de 260 componentes usan `useMemo`/`useCallback`/`React.memo`, pese a que varios
juegos tienen timers y listas de jugadores re-renderizando seguido.

- Si el componente que tocás recibe una lista (jugadores, mensajes de chat, rondas) que se
  recalcula o refiltra en cada render, memoizala con `useMemo`.
- Si pasás un callback a un componente hijo memoizado (`React.memo`) o a un efecto con
  dependencias, envolvelo en `useCallback` para no invalidar la memoización del hijo.
- No memoices por rutina donde no hay costo real (un cálculo trivial no lo necesita) — el
  costo de leer `useMemo`/`useCallback` de más también es real.

### 4. `any` disperso pese a `strict: true`

`tsconfig` tiene `strict: true` en frontend y backend, pero hay `any`/`as any` puntuales que
lo eluden (8 archivos en total al momento de la auditoría).

- Si tu cambio toca un archivo con un `any` existente, tipalo correctamente en vez de
  dejarlo pasar — casi siempre alcanza con el tipo real ya disponible en el contexto
  (`Player`, `Room`, el tipo de retorno de la función que lo produce).
- No introduzcas `any` nuevo para "hacer andar" un tipo — si el tipado genuinamente no
  cierra, es señal de un problema de diseño en esa función, no una excusa para `any`.

## Flujo de trabajo

1. Identificá qué archivo(s) de `frontend/src` o `backend/src/games/` vas a tocar.
2. Revisá esos archivos contra los 4 gaps de arriba, en el orden en que están listados.
3. Corregí lo que encuentres en esos archivos — no busques violaciones en el resto del repo.
4. Si encontrás un XSS nuevo con datos de usuario sin escapar, tratalo como bug de
   seguridad — arreglalo aunque no sea el foco del cambio que estás haciendo, y avisale al
   usuario en el resumen aunque no lo haya pedido.
5. Resumí al final qué se corrigió y por qué.
