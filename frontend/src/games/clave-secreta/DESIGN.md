# Clave Secreta — especificación funcional

Contexto para cuando se implemente este juego, así no hay que re-explicar
todo desde cero. El juego está registrado como `comingSoon: true` en
`index.jsx` — no hay nada jugable todavía, ni frontend (`LocalGame`,
`ConfigPanel`, `RoundView`) ni motor de backend (`backend/src/games/clave-secreta/`
no existe aún).

## 1. Concepto general

Juego de mesa por equipos (Rojo vs Azul) donde un "Spymaster" da pistas de
una palabra + un número para que su equipo adivine palabras relacionadas en
un tablero de 5x5 (25 palabras), evitando la palabra "asesina" (assassin) y
las del equipo contrario.

## 2. Roles

- **Spymaster (pistero):** ve el tablero con los colores ocultos (mapa de
  claves). Da pistas.
- **Operative / Field Operative (agente de campo):** solo ve las palabras,
  sin colores. Adivina.
- Cada equipo tiene 1+ spymaster y N operatives.

## 3. Tablero

- Grid de 25 palabras (5x5), tomadas de un mazo de palabras (word pack).
- Distribución de colores (para 2 equipos): 9 de un equipo (el que empieza),
  8 del otro, 7 neutrales, 1 asesino.
- Vista "spy view" (colores visibles) vs vista normal (solo texto).

## 4. Flujo de turno

1. El spymaster del equipo activo escribe una pista: una palabra + un número
   (ej: "Océano 3").
2. El equipo de campo puede adivinar hasta número + 1 veces.
3. Cada click en una palabra:
   - Si es del color correcto → se revela, el equipo puede seguir adivinando.
   - Si es neutral o del otro equipo → termina el turno (y si es del otro
     equipo, les suma progreso a ellos).
   - Si es el asesino → el equipo pierde inmediatamente.
4. El equipo puede pasar el turno voluntariamente en cualquier momento.
5. Gana el equipo que revela todas sus palabras primero.

## 5. Features de la sala pedidas en la spec original

- URL única compartible tipo slug random ("palabra-palabra"), en vez del
  código de 5 caracteres que usa el resto de Juntada (ver
  [Decisiones pendientes](#7-decisiones-pendientes-para-cuando-se-implemente)).
- Selección de equipo y rol al entrar (Rojo/Azul, Spymaster/Operative).
- Chat o reacciones opcionales.
- Botón de "nueva partida" reusando el mismo grupo de jugadores.
- Historial de pistas dadas en la partida.
- Timer opcional por turno.
- Configuración de mazo de palabras (idioma, packs temáticos, custom words).
- Modo espectador.

## 6. Cómo encaja en la arquitectura de Juntada

Este proyecto ya tiene resuelto el 90% de lo que la spec original pide como
"componentes técnicos sugeridos" (WS server, salas, sync de estado, validación
en servidor) — no hace falta construir nada de eso de nuevo. Ver
`backend/src/games/registry.js` y `frontend/src/games/registry.js` para el
contrato completo. Puntos concretos para Clave Secreta:

- **Backend:** un `backend/src/games/clave-secreta/engine.js` con
  `createConfig`, `startRound`, `handleAction`, `getPublicRoundView`,
  `getPrivateView`, igual que cualquier otro juego. La asignación de colores
  (9/8/7/1) y el reparto de palabras del pack elegido pasan en `startRound`,
  server-side — el cliente nunca decide ni ve el mapa de colores salvo que
  su rol sea spymaster (eso es exactamente para lo que existe
  `getPrivateView`, ver cómo lo usa `impostor/engine.js` para no revelar la
  palabra al impostor).
- **Equipos y roles:** `room.players` hoy es genérico (id, name, ready,
  online) sin concepto de equipo. Habría que sumar `team` ("red"/"blue") y
  `role` ("spymaster"/"operative") por jugador — algo análogo a lo que hace
  Torneo de Fútbol con `config.assignments` (playerId → equipo), pero acá además
  define qué ve cada uno (ver `getPrivateView`).
- **Validación de turno:** "no es tu turno" / "no es tu rol" se resuelve
  igual que en cualquier otro juego dentro de `handleAction(room, playerId,
action, payload)` — rechazar con `{ handled: false }` si el que manda la
  acción no es el spymaster activo o no es su turno. El nuevo banner de
  error genérico (`MultiplayerGame.jsx`, agregado para que ninguna acción
  rechazada falle en silencio) ya cubre esto sin trabajo extra.
- **Pista inválida (palabra visible en el tablero):** validarla en el
  `handleAction` del "submit_clue" equivalente, server-side, antes de
  aceptarla — mismo patrón que impostor valida `suspectId` contra los
  jugadores reales antes de aceptar un voto.
- **Historial de pistas:** análogo a `room.roundHistory` que ya usan
  impostor y sintonía.
- **Timer opcional por turno:** el motor genérico ya soporta timers de fase
  vía `getPhaseTimerEnd` / `forceReadyAndAdvance` (ver `impostor/engine.js`),
  reutilizable tal cual para el timer de turno acá.
- **Mazo de palabras:** seguir el patrón de `@juntada/impostor-data` /
  `@juntada/sintonia-data` — un paquete en `packages/` con los word packs,
  compartido entre backend (reparto server-side) y frontend (si hace falta
  para el modo local, si es que Clave Secreta tiene sentido en modo local con un
  solo dispositivo — hay que decidirlo, ver más abajo).

## 7. Decisiones pendientes para cuando se implemente

- **¿Slug random o código de 5 caracteres?** El resto de Juntada usa códigos
  cortos de 5 caracteres (`backend/src/rooms/roomCode.js`, sin 0/O/1/I para
  que se puedan decir en voz alta) pensados para compartir de palabra o
  mensaje de texto rápido. La spec pide un slug tipo "palabra-palabra" en la
  URL. Decidir si Clave Secreta usa el mismo esquema que el resto (consistencia)
  o si amerita su propio esquema de slug — y si es lo segundo, si vale la
  pena generalizarlo para todos los juegos en vez de ser un caso especial.
- **¿Tiene sentido un modo local?** Todo lo demás en Juntada tiene modo
  local (pass-and-play) además de online. Clave Secreta con roles ocultos
  (spymaster ve colores que el resto no debe ver) es más difícil de hacer
  "pasando el mismo dispositivo" sin que se hagan trampa — capaz este es el
  primer juego que solo tenga sentido online (`localOnly` inverso: sin
  `LocalGame` real, o un `LocalGame` reducido tipo "solo para spymasters
  mirando la misma pantalla por separado"). Definir esto antes de armar
  `ConfigPanel`/`RoundView`.
- **Mínimo de jugadores:** la spec pide 2 equipos con al menos 1 spymaster y
  1 operative cada uno → mínimo real son 4 jugadores (ya seteado como
  `minPlayers: 4` en `index.jsx`), pero definir si un mismo jugador puede
  ser spymaster y operative a la vez en partidas chicas (ej. 1 vs 1 con
  ambos jugando los dos roles) o si eso queda afuera del alcance inicial.
- **Chat / reacciones / modo espectador:** quedaron listados como
  "opcionales" en la spec — no bloquean una primera versión jugable, dejar
  para una iteración posterior una vez que el loop principal (pistas,
  adivinar, ganar/perder) funcione.
