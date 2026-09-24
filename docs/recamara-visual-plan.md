# Recámara — mejoras visuales

## Contexto

Queremos llevar Recámara al nivel visual de la referencia en
`docs/referencias/recamara-referencia.html`. Abrila en el navegador y leé su
script antes de planear: es un prototipo aislado (HTML + CSS + JS plano) que
muestra la meta.

Lo que tiene que quedar igual que en la referencia:

- **Mesa y arma.** Mesa en perspectiva (`rotateX` sobre la mesa, tarjetas de
  jugador contra-rotadas para quedar paradas). Escopeta en SVG en vez de los
  tres `div`s actuales.
- **Recarga.** Se muestran los cartuchos reales/falsos, se dan vuelta, se
  mezclan y entran al arma de a uno.
- **Disparo.** Apuntado lento con latido. Temblor antes del gatillo.
  - Real: fogonazo, humo, sacudida de la escena, flash y golpe en la tarjeta
    del objetivo; si el objetivo soy yo, además viñeta roja.
  - Falsa: clic seco con casi nada de movimiento.
  - En ambos casos, el cartucho vacío sale en arco 3D y queda en la mesa.
- **Sonido y vibración.** Sonido sintetizado con Web Audio y vibración con
  `navigator.vibrate`. Botón de silencio que se recuerda.
- **Ítems.** Sierra con chispas y caño que se acorta; lupa que revela el
  cartucho solo a quien la usa; cigarro con humo y vida que reaparece.
- **Accesibilidad.** Todo respeta `prefers-reduced-motion`.

La lógica del juego NO cambia: ni `packages/recamara-engine` ni
`backend/src/games/recamara`. Esto es solo presentación.

## Fases (una rama y una PR a `staging` por fase, en orden)

### 1. Cola de eventos (sin cambios visuales)

Un "director" que reproduce disparos e ítems de a uno y en orden. El estado
visible avanza cuando la animación llega a ese punto, no cuando llega el
mensaje del server. Reemplaza `frozenState`, `frozenLog`, `settledStateRef`,
`prevLogRef`, `fireStageRef` y la cadena de timeouts de `RoundView`, y lo usa
también `LocalGame`. La reconexión vacía la cola y salta al estado actual.

Caso a cubrir: llega un segundo `pendingFire` mientras otro jugador sigue
mirando el banner del disparo anterior. Hoy el banner se pisa y las vidas
muestran un estado viejo; tiene que quedar encolado.

Tests: unitario de la cola y e2e de dos jugadores.

### 2. Mesa en perspectiva y escopeta en SVG

`arena.css`, `shotgun-banner.css`, `ChamberCard`. Reusar `seatAngle` y
`shortestGunAngle`.

### 3. Sonido y vibración

Hook `useRecamaraSfx`, con el silencio guardado en localStorage.

### 4. Recarga animada, cartucho eyectado y animaciones de ítems

`ChamberCard`, `ItemActivatingOverlay` y la eyección del cartucho.

## Reglas

- Seguir `CLAUDE.md`: plan primero, archivos chicos, commits convencionales
  en español.
- No commitear ni pushear sin que lo pida.
- Probar cada fase en el navegador, en modo local y online.
