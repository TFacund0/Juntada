# Riel Salvaje — plan de implementación

Este documento complementa a `DESIGN.md` (que define **qué** hace el
juego) con el **cómo** y **en qué orden** se va a construir. La idea es
avanzar en fases chicas y verificables — cada una entrega algo que se
puede probar antes de sumar la siguiente capa de complejidad — porque este
es, de lejos, el juego con más estado simultáneo de todo Juntada (turnos
propios por jugador, mazos parcialmente ocultos, un personaje neutral que
se mueve solo, eventos condicionales). Mezclar reglas con UI desde el
arranque es la forma más fácil de terminar con bugs de sincronización
difíciles de rastrear.

## Antes de arrancar: qué mirar del resto del repo

- `backend/src/games/registry.ts` y `frontend/src/games/registry.ts` —
  contrato que todo juego de Juntada implementa (`createConfig`,
  `startRound`, `handleAction`, `getPublicRoundView`, `getPrivateView`).
  No hay que inventar una arquitectura nueva, hay que encajar en esta.
- `backend/src/games/recamara/engine.ts` + `backend/test/recamaraEngine.test.ts`
  — el juego más parecido en complejidad de estado oculto actual del repo.
  Sirve de referencia de estilo (cómo separan lógica pura de la capa de
  red, cómo testean).
- `frontend/src/games/impostor/engine.ts` — referencia de cómo se oculta
  información sensible a un jugador específico vía `getPrivateView` (en
  ese caso la palabra secreta; acá van a ser los mazos y bolsas ocultas).
- `packages/core-utils/index.ts` — utilidades compartidas (shuffle, etc.)
  ya extraídas; revisar antes de reescribir algo que ya exista ahí.

## Fase 0 — Modelo de datos (tipos puros, sin lógica)

**Qué se hace:** definir en TypeScript la forma de todo el estado del
juego, sin implementar todavía ninguna regla. Esto incluye:

- El tren: lista de vagones (Locomotora + N según jugadores), cada uno con
  dos "slots" (interior/techo), ocupantes y fichas de botín por slot.
- Las fichas de botín: tipo (bolsa/joya/maletín), valor real, y si está
  boca arriba o boca abajo (y para quién — el dueño de una bolsa la ve, los
  demás no).
- El estado de cada jugador: personaje elegido, posición (vagón + piso),
  mazo personal (cartas en mano, cartas jugadas esta ronda, cartas en
  mazo/descarte), balas recibidas, botín acumulado.
- El Marshal: posición, mazo compartido de balas neutrales restante.
- La carta de ronda activa: cantidad de turnos, ícono por turno (boca
  arriba / Túnel / Acelerar / Cambio de vía), evento asociado.
- El progreso de la partida: ronda actual (1-5), fase actual
  (Planificación / Acción / Evento de fin de ronda).

**Qué tener en cuenta:**

- Diseñar los tipos pensando en **qué parte es pública y qué parte es
  privada por jugador** desde el día uno — evita tener que reestructurar
  todo cuando llegue la Fase 2 (`getPrivateView`). Por ejemplo, el valor
  real de una bolsa debería vivir en un campo que el motor sabe filtrar,
  no mezclado indistintamente con el resto del estado del vagón.
- No metas lógica acá todavía, ni siquiera "helpers" — es tentador, pero
  el objetivo de esta fase es que el modelo de datos se pueda revisar y
  discutir antes de construir nada encima.
- Contrastar cada tipo contra `DESIGN.md` sección por sección al terminar,
  como checklist.

## Fase 1 — Motor de reglas puro (sin red, sin servidor)

**Qué se hace:** las funciones que implementan las reglas del juego,
100% testeables con Jest sin levantar nada — reciben estado + acción,
devuelven estado nuevo (o error). Concretamente:

- `createConfig`: arma la partida — reparte vagones según cantidad de
  jugadores, distribuye botín por vagón, arma los 6 personajes
  disponibles, sortea Jugador Inicial, arma el mazo de 4+1 cartas de ronda.
- `startRound`: prepara una ronda — revela la carta de ronda, resetea
  turnos, cada jugador mezcla su mazo y saca su mano (6, o 7 para Búho).
- Resolución de **Fase Planificación**: apilar una carta por turno (boca
  arriba/abajo según ícono), alternativa de robar 3, avance de turno,
  manejo de Cambio de vía (invierte sentido) y Acelerar (doble turno).
- Resolución de **Fase Acción**: recorrer los mazos apilados en el orden
  correcto y aplicar cada efecto (Mover, Cambiar de piso, Robar, Disparar,
  Golpear, Mover Marshal), incluyendo las habilidades de personaje que
  rompen la regla general (ver lista abajo).
- Resolución de **Evento de fin de ronda**: las 8 variantes ya definidas
  en `DESIGN.md` 4.4, más el evento propio "Alarma en el tren".
- Cierre de partida: sumar botín, calcular Título de Pistolero, aplicar
  desempate.

**Qué tener en cuenta (la parte que más bugs suele generar en este tipo de
juego):**

- **Las 6 habilidades de personaje son excepciones a la regla general**,
  no casos aparte — conviene que la función que resuelve cada acción base
  (disparar, golpear, etc.) reciba el personaje como parámetro y consulte
  su habilidad en el punto exacto donde la regla general se rompe, en vez
  de tener un `if (personaje === 'Sombra')` disperso por todo el código.
  Ejemplos concretos a testear cada uno por separado:
  - Víbora dispara dentro de su propio vagón (único caso permitido).
  - Trueno empuja al objetivo al disparar, respetando "nunca sale del
    tren" en los bordes.
  - Sombra juega su primer turno oculto aunque no sea Túnel, pero pierde
    la habilidad esa ronda si robó en vez de jugar.
  - Búho arranca con 7 cartas, no 6.
  - Dalia no puede ser objetivo si hay otro bandido elegible.
  - Urraca se queda la bolsa (no joya, no maletín) que hace soltar con un
    puñetazo.
- **La regla "nunca se abandona el tren"** aplica a cualquier movimiento
  forzado (disparo de Trueno, empujón de puñetazo, eventos que mueven
  gente) — conviene un único helper de "mover N vagones, clampeado a los
  extremos" reusado por todos esos casos, no reimplementado en cada uno.
- **Secreto de las bolsas:** el motor debe poder calcular el valor real
  siempre (para puntaje final) pero exponer distinto según quién pregunta
  — esto se resuelve bien acá aunque no haya red todavía, dejando que la
  función de resolución devuelva el estado completo y sea la Fase 2 la que
  decida qué recorta por jugador.
- **Mazo compartido de 13 balas neutrales:** se agota — testear el caso
  límite de qué pasa cuando un evento/Marshal necesita repartir una bala y
  no queda ninguna (no debe explotar, simplemente no se entrega).
- **Empates:** Título de Pistolero (todos los empatados cobran) y
  desempate de ganador de partida (menos balas recibidas) son casos que se
  olvidan fácil si no se testean explícitamente con un mazo de partida
  armado a mano.
- Cada función de esta fase debe ser **pura** (mismo input → mismo
  output, sin mutar el estado recibido) — hace que los tests sean
  deterministas y que la Fase 2 pueda usarlas sin sorpresas de estado
  compartido.
- Escribir los tests **por regla, no por escenario completo** primero
  (unit tests chicos de "Trueno empuja correctamente en el borde del
  tren"), y recién después uno o dos tests de partida completa de punta a
  punta como red de seguridad.

## Fase 2 — Integración backend (WebSocket + registry)

**Qué se hace:** conectar el motor puro de la Fase 1 al patrón real de
Juntada:

- `backend/src/games/riel-salvaje/engine.ts` implementando el contrato de
  `registry.ts` (mismo que ya usan el resto de los juegos).
- `getPublicRoundView`: el estado del tren, posiciones, botín visible
  ("?" para lo ajeno, valor real para lo propio) — nada que un jugador no
  deba ver.
- `getPrivateView`: durante la fase Planificación, cada jugador manda sus
  cartas apiladas como acción privada; el motor no debe exponer el mazo de
  nadie más hasta que arranque la fase Acción (turnos boca arriba se
  revelan apenas se juegan; los Túnel se guardan ocultos server-side hasta
  ejecutarse).
- `handleAction`: valida cada acción contra las reglas server-side —
  nunca confiar en lo que ya filtró el cliente (mismo patrón que el resto
  de Juntada). Ejemplos concretos de validaciones que hay que blindar acá:
  "no podés Robar si no estás en ese vagón", "no podés Disparar sin línea
  de visión", "no podés tocar el maletín con el Marshal presente".

**Qué tener en cuenta:**

- Esta fase es donde se decide **qué campos del estado nunca deben viajar
  al cliente equivocado** — conviene armar una tabla explícita (campo →
  quién lo puede ver) antes de escribir `getPublicRoundView`, en vez de ir
  filtrando ad-hoc.
- Reconexión: las cartas ya apiladas de un jugador desconectado quedan
  como están (ya definido en `DESIGN.md` sección 7) — verificar que el
  motor no dependa de que el jugador esté "conectado" para avanzar de fase.
- Mínimo/máximo de jugadores (3 a 6) se valida acá, en `createConfig`, no
  en el frontend.
- Escribir tests de integración (server) además de los unitarios del
  motor — algo puede estar bien en Fase 1 y romperse en cómo se conecta al
  WebSocket (orden de eventos, timing de reveal).

## Fase 3 — Frontend mínimo jugable (sin pulido visual)

**Qué se hace:** `LocalGame`, `ConfigPanel` y `RoundView` funcionales pero
sin ningún diseño — botones de texto plano, sin animaciones, sin el HUD
del prototipo. El objetivo único de esta fase es **jugar una partida
completa de punta a punta** con gente real (o vos mismo en varias
pestañas) y confirmar que las reglas se sienten bien en la práctica.

**Qué tener en cuenta:**

- Es común que algo que parece correcto en el papel (o en los tests de la
  Fase 1) se sienta raro o confuso jugando de verdad — por ejemplo, el
  ritmo de la fase de revelado, o si 5 rondas se sienten largas/cortas.
  Esta fase existe para detectar eso barato, antes de invertir en diseño
  visual sobre una base que capaz cambia.
- `ConfigPanel` acá ya debe fijar mínimo 3 / máximo 6 jugadores.
- No hay que resistir la tentación de "ya que estoy, le pongo un poco de
  estilo" — cuanto más neutro quede esta fase, más fácil es notar si un
  problema es de reglas (Fase 1/2) o de presentación (Fase 4).
- Jugar explícitamente los casos raros al menos una vez: una ronda con
  Cambio de vía, una con Acelerar, un evento de fin de ronda de cada tipo,
  el mazo de balas neutrales agotándose, un empate de Pistolero.

## Fase 4 — Pulido visual

**Qué se hace:** recién acá se aplica el diseño del prototipo/artifact
(HUD, tren horizontal con scroll, feed de revelado carta por carta,
pantalla de evento de fin de ronda, inspector de jugador, transición a
landscape) sobre la base funcional ya probada en la Fase 3.

**Qué tener en cuenta:**

- Landscape: la transición "🔄 girá tu teléfono" y el resto del flujo ya
  está pensado en `DESIGN.md` sección 8 — implementarlo tal cual está ahí.
- Revisar el artifact publicado (link en la conversación de diseño) como
  referencia visual, pero no como spec exacta — es un mockup con datos de
  ejemplo, no todos los estados posibles del juego están cubiertos ahí.
- Es la fase donde vale la pena invertir en animaciones puntuales (el
  volteo de carta al revelar, el desplazamiento de una ficha al moverse)
  — pero solo después de que el comportamiento de base ya esté validado.

## Checklist transversal (aplica a todas las fases)

- Nunca usar los nombres del juego original ni los 6 nombres de personaje
  reales en código, comentarios, assets o commits — usar siempre "Riel
  Salvaje" y Víbora/Trueno/Sombra/Búho/Dalia/Urraca (ver nota de
  propiedad intelectual en `DESIGN.md`).
- No commitear ningún PDF, imagen o texto extraído literalmente del manual
  oficial — las reglas ya están reformuladas en `DESIGN.md`, esa es la
  única fuente que debería hacer falta consultar durante el desarrollo.
- Cualquier decisión de diseño que se tome durante la implementación y no
  esté en `DESIGN.md` (ajustes de balance, ambigüedades que aparezcan
  jugando) debería volcarse ahí para no perderla.
