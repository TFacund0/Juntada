# Colt Express — especificación funcional

Contexto para cuando se implemente este juego, así no hay que re-explicar
todo desde cero. Basado en el diseño original de mesa de Christophe Raimbault
y Jordi Valbuena (Colt Express, Ludonaute 2014) — esta es una adaptación para
jugarse online en Juntada, no una copia 1:1 de las reglas físicas. El juego
está pensado para registrarse como `comingSoon: true` en `index.tsx` — no hay
nada jugable todavía, ni frontend (`LocalGame`, `ConfigPanel`, `RoundView`) ni
motor de backend (`backend/src/games/colt-express/` no existe aún).

Prototipos visuales de referencia (artifacts de Claude, no forman parte del
repo): tablero de juego con HUD, inspector de jugador propio/rival, pantalla
de reglas y roster de personajes — todos pensados para jugarse en **landscape**
(ver sección 8).

## 1. Concepto general

Juego de atraco por turnos simultáneos ocultos: seis forajidos suben a un
tren en marcha para robar el botín antes de que termine el viaje. Cada ronda
se juega en dos fases — **Planificación** (todos apilan cartas de acción a
ciegas, sin ver lo que hacen los demás) y **Acción** (se revela y ejecuta el
mazo combinado de todos los jugadores, carta por carta, en orden). Gana quien
termine la partida con más valor en botín acumulado.

## 2. Componentes del tablero

- **El tren:** 5 a 7 vagones en fila (Locomotora, Tender, Equipaje,
  Restaurante, Pasajeros, Correo, Caballeriza — el mapa exacto es
  configurable por partida, ver sección 9). Cada vagón tiene dos "capas":
  **interior** y **techo**.
- **Botín por vagón:** cada vagón interior arranca con una combinación de
  ítems repartidos según las reglas de la partida:
  - 💰 **Bolsas de dinero** — valor fijo, ej. $250/$350/$500.
  - 💎 **Diamantes** — valor fijo, más alto que una bolsa (ej. $500/$550).
  - 💼 **Maletín del Sheriff** — solo en la Locomotora, el ítem de mayor
    valor (ej. $1000), custodiado por el Sheriff.
- **El Sheriff:** un personaje neutral, fijo en el techo de la Locomotora
  al arrancar la partida. Nadie puede robar el maletín mientras el Sheriff
  esté ahí — hay que noquearlo primero (con una carta de Golpear/Disparar
  dirigida a esa posición) para que el maletín quede disponible.
- **El Marshal:** amenaza neutral independiente de los jugadores. Se mueve
  por el techo del tren entre rondas (o según trigger de carta, ver sección
  4.4) y dispara a cualquier forajido que comparta su vagón, obligándolo a
  soltar un ítem de su botín acumulado.

## 3. Personajes (6 forajidos, cada uno con una habilidad que rompe una regla)

| Personaje    | Habilidad                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Tuco**     | Puede disparar dos veces con una sola carta de Disparar.                                                          |
| **Django**   | Su alcance de disparo no se bloquea por vagones intermedios: dispara en línea recta a cualquier distancia.        |
| **Ghost**    | Puede moverse entre interior y techo de un mismo vagón sin gastar una carta de Movimiento.                        |
| **Doc**      | Cada bala que recibe se convierte en un botín falso de menor valor: siempre se queda con algo aunque lo disparen. |
| **Belle**    | Inmune a los puñetazos: nadie puede empujarla ni noquearla cuerpo a cuerpo.                                       |
| **Cheyenne** | Puede robar el botín de un vagón adyacente sin moverse hasta él.                                                  |

Cada jugador elige (o se le asigna) uno de estos seis al empezar la partida.
Con más de 6 jugadores no hay personajes repetidos posibles en la versión
base — definir si se permite repetir o si eso limita el máximo de jugadores
(ver sección 9).

## 4. Flujo de una ronda

### 4.1 Fase Planificación

1. Por turnos (orden rotativo o fijo, a definir), cada jugador apila 1 o 2
   cartas de acción boca abajo en su propio mazo personal, sin ver lo que
   apilan los demás.
2. Cartas de acción disponibles: **Moverse**, **Robar**, **Disparar**,
   **Golpear (puñetazo)**, **Subir/bajar del techo**. Cada jugador tiene una
   mano limitada y repartida al azar (con cantidad de copias distinta según
   la carta — Moverse es la más común).
3. Algunas rondas (definidas por el mapa/mazo de ronda, no todas) permiten
   que una de las cartas apiladas quede oculta hasta el momento de
   ejecutarse — nadie, ni siquiera el jugador que la jugó, sabe con certeza
   el orden relativo de esa carta hasta la fase de Acción.
4. Cuando todos terminaron de apilar, se pasa a la fase Acción.

### 4.2 Fase Acción

1. Se combinan los mazos de todos los jugadores en un único orden de
   resolución (intercalado según el orden en que se apilaron las cartas, no
   por jugador).
2. Se revela y ejecuta una carta a la vez, aplicando su efecto de inmediato
   (mover ficha, robar ítem, restar/sumar botín, aplicar bala/golpe).
3. Las cartas ocultas se revelan recién en el momento en que les toca
   ejecutarse — pueden cambiar el resultado esperado de una jugada de otro
   jugador (ej. alguien se mueve a un vagón esperando estar solo, y una
   carta oculta hace que otro llegue antes).
4. Al terminar de ejecutar todo el mazo combinado, la ronda termina.

### 4.3 Disparar y golpear

- **Disparar:** requiere línea de visión (mismo nivel — interior o techo —
  y sin otro jugador bloqueando el vagón intermedio, salvo habilidad que lo
  ignore). El objetivo recibe una carta de **Bala** que se mezcla en su
  propio mazo de acción (ocupa espacio que podría haber usado para jugar
  otra cosa en rondas siguientes) y suelta un ítem de botín si tiene.
- **Golpear (puñetazo):** cuerpo a cuerpo, mismo vagón y misma capa. Empuja
  al objetivo a un vagón adyacente (interior→interior o techo→techo) y le
  hace soltar un ítem si tiene.

### 4.4 Recompensa por disparos acumulados (regla propia de esta adaptación)

- El juego lleva un contador de **disparos acertados por objetivo**, por
  jugador (ej. "cuántas veces le acerté a Django en total durante la
  partida", no solo en esta ronda).
- Al llegar a **5 disparos acertados sobre el mismo objetivo**, el jugador
  que dispara cobra un bono instantáneo de **$1000**, agregado directo a su
  botín (no requiere robar nada físicamente).
- El contador es visible en el HUD de cada jugador durante toda la partida
  (ver sección 8). No existe en el juego de mesa original — es una adición
  para darle un objetivo secundario claro a la estrategia de "personaje
  ofensivo" en la versión digital.

### 4.5 El Marshal

- Se mueve un vagón por ronda (dirección y regla de movimiento exacta a
  definir — en el original avanza hacia donde hay más jugadores).
- Dispara automáticamente a todo jugador que comparta su vagón al momento
  de moverse, quitándole un ítem de botín.
- Quien lo noquea por última vez en la partida (con una carta dirigida a su
  posición) se lleva un bono de botín extra (valor a definir, ej. $500).

## 5. Fin de la partida

- La partida se juega a lo largo de un número fijo de **asaltos** (rondas
  completas de Planificación + Acción — el original usa 5, con la última
  "de noche" y reglas especiales de visibilidad reducida).
- Al terminar el último asalto, cada jugador suma el valor de todo su botín
  acumulado (bolsas + diamantes + maletín si lo consiguió + bonos de
  disparos/Marshal). Gana quien tenga más.
- Las balas y golpes recibidos no restan directamente del total — su costo
  real es haber ocupado espacio en el mazo de acción durante la partida
  (una oportunidad perdida de jugar otra carta), más cualquier ítem que se
  haya soltado al recibirlos.

## 6. Cómo encaja en la arquitectura de Juntada

Este proyecto ya tiene resuelto el 90% de lo que hace falta como
infraestructura técnica (WS server, salas, sync de estado, validación en
servidor) — no hace falta construir nada de eso de nuevo. Ver
`backend/src/games/registry.ts` y `frontend/src/games/registry.ts` para el
contrato completo. Puntos concretos para Colt Express:

- **Backend:** un `backend/src/games/colt-express/engine.ts` con
  `createConfig`, `startRound`, `handleAction`, `getPublicRoundView`,
  `getPrivateView`, igual que cualquier otro juego. La fase Planificación es
  el caso de uso perfecto para `getPrivateView`: cada jugador manda sus
  cartas apiladas como acción privada, y el motor **no debe** exponer el
  mazo de nadie más hasta que arranque la fase Acción — comparar con cómo
  `impostor/engine.ts` oculta la palabra secreta al impostor.
- **Cartas ocultas dentro de la fase Acción:** una vez reveladas todas las
  pilas al pasar a Acción, ya no hay secreto de servidor que guardar — el
  "misterio" para el jugador es de UI/ritmo de reveal (feed animado carta
  por carta), no de datos ocultos; el estado que le llega al cliente en ese
  punto puede ser público.
- **Resolución de la fase Acción:** es la pieza de lógica más compleja del
  motor — intercalar los mazos de todos los jugadores en el orden correcto
  y aplicar efectos secuenciales que pueden alterarse entre sí (ej. alguien
  se mueve antes de que le disparen). Aislarla como función(es) pura(s),
  testeable con casos de mazo fijo, antes de conectarla al WebSocket.
- **Estado del tren:** vagones, capas (interior/techo), ítems de botín y
  ocupantes por vagón — estructura de datos central que tanto
  `getPublicRoundView` como el resolutor de Acción necesitan leer/escribir.
  Candidato a vivir en un paquete compartido (`packages/colt-express-*`) si
  se termina haciendo modo local además de online (ver sección 9).
- **Contador de disparos acumulados y bono de $1000:** estado por
  jugador×objetivo, se actualiza en el mismo `handleAction` que resuelve un
  disparo. Trivial de testear aparte del resto del motor.
- **Validación de acciones:** "no podés Robar si no estás en ese vagón",
  "no podés Disparar sin línea de visión", "no podés tocar el maletín con
  el Sheriff presente" — todo se valida server-side dentro de
  `handleAction`, nunca confiando en lo que ya validó la UI (mismo patrón
  que el resto de Juntada).

## 7. Decisiones pendientes para cuando se implemente

- **¿Tiene sentido un modo local (pasar el mismo dispositivo)?** La
  Planificación depende de que nadie vea las cartas de los demás — algo que
  el resto de Juntada resuelve gratis en modo online (cada jugador tiene su
  propio dispositivo) pero que en modo local pass-and-play requeriría un
  patrón tipo "mirá para otro lado" o directamente no tener modo local
  (similar al caso de Clave Secreta, ver `frontend/src/games/clave-secreta/DESIGN.md`).
- **Mapa/mazo de ronda:** el original varía el mapa de vagones y qué rondas
  permiten carta oculta según un "mazo de objetivos" de la partida. Definir
  si la v1 tiene un solo mapa fijo o si se banca mapas configurables desde
  el arranque.
- **Cantidad de asaltos y duración de cada uno:** el original usa 5 asaltos
  con tiempos de Planificación distintos por asalto. Definir si eso se
  replica o se simplifica a un número fijo de cartas por ronda.
- **Balance de la recompensa por disparos acumulados:** $1000 al quinto
  disparo es un valor de partida (sección 4.4), no viene del juego
  original — ajustar según cómo se sienta en playtesting, junto con el
  resto de valores de botín.
- **Repetición de personajes:** con más de 6 jugadores, decidir si se
  permite repetir personaje o si eso pone un techo de 6 jugadores por
  partida.
- **Reconexión durante la fase Planificación:** si un jugador se desconecta
  mientras apila cartas, definir si sus cartas quedan "congeladas" tal como
  estaban o si se le da tiempo extra al reconectar — el resto de Juntada ya
  tiene manejo de reconexión genérico (`useMultiplayerSocket.ts`), pero el
  timing de una fase de planificación simultánea es más sensible que un
  juego por turnos.

## 8. Orientación de pantalla (landscape)

A diferencia del resto de los juegos de Juntada (todos pensados para
portrait, un teléfono parado), Colt Express se juega mejor en horizontal:
el tren es el elemento central del tablero y necesita ancho para mostrar
varios vagones a la vez con su techo y su interior legibles.

Flujo de pantalla sugerido:

1. **Lobby y selección de personaje:** en portrait, como el resto de
   Juntada (consistencia con el flujo genérico de sala).
2. **Transición al arrancar la partida:** pantalla intermedia de
   "🔄 girá tu teléfono", antes de mostrar el tablero.
3. **Tablero de juego (landscape):** HUD arriba con plata actual del
   jugador, cantidad de ítems de botín que lleva encima, y un tracker de
   disparos acertados por objetivo (con aviso visual al llegar al quinto,
   ver sección 4.4). El tren ocupa el centro con scroll horizontal — cada
   vagón muestra una "tapa" de techo (ocupantes, Sheriff/maletín si aplica)
   sobre el cuerpo del vagón (botín real ítem por ítem, ocupantes del
   interior). La mano de cartas de la fase Planificación queda fija a un
   costado, siempre visible.
4. **Inspector de jugador (overlay sobre el tablero, landscape):** se abre
   tocando cualquier avatar en el tren — muestra personaje, habilidad,
   posición actual y botín ítem por ítem. En el propio perfil es de solo
   lectura; en el de un rival, cada ítem robable tiene una acción directa
   de "Robar" cuando las reglas lo permiten (mismo vagón, misma capa, es tu
   turno de Acción). Tabs arriba para saltar entre perfiles sin cerrar el
   overlay.
5. **Reglas y roster de personajes:** accesibles como overlay desde el
   lobby o un ícono de ayuda dentro de la partida. Estas dos quedan bien en
   portrait (son contenido para leer, no tablero para operar), pero no hay
   problema técnico en ofrecerlas también en landscape si se prefiere
   consistencia total con el resto del flujo de juego.

## 9. Configuración de partida (a definir en `ConfigPanel`)

- Cantidad de jugadores (mínimo probable: 2, la mesa original soporta 2–6).
- Cantidad de asaltos (ver sección 7).
- Mapa de vagones a usar, si se banca más de uno.
- Activar/desactivar la mecánica de bono por 5 disparos acumulados
  (sección 4.4), y su valor, si se quiere dejar configurable en vez de
  fijo en $1000.
