# Riel Salvaje — especificación funcional

> **Nota de propiedad intelectual:** este juego está _inspirado_ en la
> mecánica de un juego de mesa de atraco de trenes conocido comercialmente
> bajo otro nombre (Christophe Raimbault / Jordi Valbuena, Ludonaute 2014).
> Las reglas y mecánicas de un juego de mesa no están protegidas por
> derecho de autor, pero el nombre, los nombres de personajes y el arte sí
> lo están — por eso esta adaptación usa un **nombre propio** ("Riel
> Salvaje") y **6 personajes con nombres originales** (ver sección 3), sin
> reutilizar marca, arte ni texto del juego original. El manual oficial
> que se consultó para verificar mecánicas **no está guardado en este
> repo** (se movió fuera, a uso privado) para no distribuir un documento
> con copyright de terceros.

Contexto para cuando se implemente este juego, así no hay que re-explicar
todo desde cero. Esta es una adaptación para jugarse online en Juntada, no
una copia 1:1 de ningún juego físico existente. El juego está pensado para
registrarse como `comingSoon: true` en `index.tsx` — no hay nada jugable
todavía, ni frontend (`LocalGame`, `ConfigPanel`, `RoundView`) ni motor de
backend (`backend/src/games/riel-salvaje/` no existe aún).

Prototipos visuales de referencia (artifacts de Claude, no forman parte del
repo): tablero de juego con HUD, inspector de jugador propio/rival, pantalla
de reglas y roster de personajes — todos pensados para jugarse en **landscape**
(ver sección 8).

## 1. Concepto general

Juego de atraco por turnos: seis forajidos suben a un tren en marcha para
robar el botín antes de que termine el viaje. Cada ronda se juega en dos
fases — **Planificación** (cada jugador apila cartas de acción en su propio
mazo personal, turno a turno; por defecto se juegan **visibles** apenas se
colocan, salvo en los turnos marcados como "Túnel", que se juegan ocultos)
y **Acción** (se ejecuta el mazo de cada jugador en el orden en que se
apiló, revelando recién ahí las cartas que quedaron ocultas). Gana quien
termine la partida con más valor en botín acumulado.

> Corrección: la idea de "todo se juega a ciegas, sin ver lo que hacen los
> demás" no es del todo cierta — ver el detalle de íconos en 4.1. Solo los
> turnos "Túnel" son realmente ocultos; el resto se ve apenas se juega.

## 2. Componentes del tablero

> Corregido contra las reglas oficiales (UltraBoardGames, consultado
> 2026-07-27) — ver fuentes al final del documento. El original **no** tiene
> un "Sheriff" separado del Marshal: es un solo personaje neutral.

- **El tren:** Locomotora + tantos vagones como jugadores. Como esta
  adaptación define mínimo 3 y máximo 6 jugadores (ver sección 4), el tren
  va de 3 vagones + Locomotora (4 tableros) hasta 6 vagones + Locomotora
  (7 tableros) — no aplica la excepción de 2 jugadores del original porque
  no se banca esa cantidad de jugadores. Cada vagón tiene dos "capas":
  **interior** y **techo**.
- **Botín total del juego:** 26 fichas en total — **18 bolsas** de dinero
  (valor entre $250 y $500, mezcladas al azar), **6 joyas** (siempre valen
  **$500** cada una) y **2 maletines** (siempre valen **$1000** cada uno).
  Cada vagón tiene un piso con una cantidad y tipo de fichas ya impresa
  (fija por diseño del tablero); las bolsas que le tocan se eligen al azar
  del pool de 18 y se colocan boca abajo con valor oculto.
- **Secreto de las bolsas — corrección importante:** el valor de una bolsa
  está oculto **para los oponentes**, pero el dueño de la bolsa **puede
  mirarlo cuando quiera** una vez que la tiene sobre su carta de Personaje.
  No es "nadie sabe el valor hasta que se roba" como yo había puesto antes
  — vos podés revisar en cualquier momento el valor de lo que ya tenés
  encima, solo los demás no lo ven.
- **Maletín:** uno se coloca siempre dentro de la Locomotora al arrancar la
  partida, junto al Marshal. El **segundo maletín** se guarda aparte, cerca
  de la Locomotora fuera del tren, y solo entra en juego si sale el evento
  de ronda "¡A por todas!" (ver 4.4), que lo coloca en el vagón donde esté
  el Marshal en ese momento.
- **Bolsa inicial del jugador:** cada jugador arranca la partida con una
  bolsa de **$250 boca abajo** ya sobre su carta de Personaje (no es un
  ítem que haya que robar — se la queda desde el principio, con el mismo
  secreto que cualquier otra bolsa: solo él puede verificar su valor).
- **Mazo de Balas Neutrales:** hay **13 cartas de Bala Neutral compartidas**
  entre todos los jugadores (no una por jugador), colocadas junto a la
  Locomotora al empezar. Se reparten cuando el Marshal coincide con un
  bandido o cuando un evento de fin de ronda dispara balas neutrales. Si
  el mazo se agota, **se retira de la partida** y esos disparos/eventos ya
  no entregan bala a nadie por el resto de la partida.
- **El Marshal:** único personaje neutral del juego (no hay Sheriff aparte).
  Arranca en la Locomotora junto al primer maletín. Se mueve por acción de
  los jugadores (carta "Marshal", ver 4.3) o por evento de ronda (ver 4.4).
  Si termina compartiendo vagón con uno o más bandidos, cada uno debe subir
  de inmediato al techo de ese vagón (incluso si acababa de bajar de ahí) y
  recibe una carta de Bala Neutral del mazo compartido. Ningún bandido
  puede quedarse en el interior de un vagón donde está el Marshal — el
  Marshal nunca sube al techo, así que ahí siempre están a salvo de él.

## 3. Personajes (6 forajidos, cada uno con una habilidad que rompe una regla)

> Habilidades corregidas contra el original (antes el doc tenía inventadas
> unas propias que no coincidían con ninguna de las 6 reales), pero con
> **nombres de personaje 100% propios** (Víbora, Trueno, Sombra, Búho,
> Dalia, Urraca) — el original usa otros 6 nombres, protegidos como marca
> del juego de mesa; las mecánicas/habilidades en sí no están protegidas
> por derecho de autor, así que se pueden replicar, pero los nombres no.

| Personaje  | Habilidad                                                                                                                                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Víbora** | Puede disparar a un bandido en su **mismo vagón** pero en **otro piso** (a través del techo) — el único caso donde se puede disparar dentro del propio vagón.                                                                                       |
| **Trueno** | Su disparo hace retroceder: el objetivo se mueve un vagón en la dirección que Trueno elija, además de recibir la bala. Nunca lo empuja fuera del tren (si ya está en el extremo, no se mueve más).                                                  |
| **Sombra** | En su **primer turno de cada ronda**, puede jugar su carta de acción boca abajo sobre su propio mazo personal (aunque el turno no tenga el ícono Túnel). Si en cambio decide robar 3 cartas en ese primer turno, **pierde la habilidad esa ronda**. |
| **Búho**   | Al principio de cada ronda roba **7 cartas** en lugar de 6.                                                                                                                                                                                         |
| **Dalia**  | No puede ser objetivo de un disparo o puñetazo si hay otro bandido que sea un objetivo válido para esa acción.                                                                                                                                      |
| **Urraca** | Al pegar un puñetazo, la ficha que suelta la víctima cae al piso del vagón como siempre — pero si es una **bolsa** (no una joya ni un maletín), Urraca la recoge de inmediato para ella en el mismo turno, en vez de dejarla tirada.                |

Cada jugador elige uno de estos seis al empezar la partida. Con más de 6
jugadores no hay personajes repetidos posibles — no aplica en esta
adaptación porque el máximo de jugadores ya es 6 (ver sección 4). Si dos o
más jugadores quieren el mismo personaje durante la selección, se
desempata con un **sorteo al azar** entre ellos (así resuelve el original
la elección del Jugador Inicial cuando hay fichas de personaje en juego,
ver 4.1).

## 4. Flujo de una ronda

**Jugadores: mínimo 3, máximo 6** (decisión de esta adaptación). No se
banca la variante oficial de 2 jugadores (equipos de 2 personajes) — ver
sección 7. Como el máximo es 6 y hay 6 personajes, nunca hace falta repetir
personaje entre jugadores.

**Jugador Inicial de la 1ª ronda:** se sortea al azar entre las fichas de
los personajes elegidos por los jugadores — a quien le toque esa ficha es
el Jugador Inicial de la primera ronda. De ahí en adelante, al final de
cada ronda el rol pasa al jugador a la izquierda (ver 4.2).

La partida dura **5 rondas** fijas. A diferencia del original (que separa
las cartas de ronda en un mazo para 2-4 jugadores y otro para 5-6), en esta
adaptación se usa **un solo mazo de 7 cartas de ronda para todo el rango
3-6 jugadores** (simplificación propia — el set ya definido en 4.4.1). Se
roban **4 al azar** de esas 7 (las 3 restantes no se usan en toda la
partida) y se agrega, para la 5ª y última ronda, **1 carta de "Estación de
tren"** elegida al azar de las 3 ya definidas (ver 4.4.1). Cada carta de
ronda indica cuántos turnos juega cada jugador (vía íconos) y condiciones
especiales (boca abajo, jugar 2 seguidas, orden invertido, etc.).

### 4.1 Fase Planificación

1. En orden de turno (rotativo — el primer jugador cambia cada ronda, ver
   4.2), cada jugador apila **1 carta de acción** en su propio mazo
   personal (mazo individual por jugador, no uno compartido) — **boca
   arriba por defecto** (visible para todos apenas se coloca) o **boca
   abajo si el turno actual tiene el ícono Túnel** (ver punto 3). En vez de
   jugar una carta, el jugador puede optar por **robar 3 cartas** nuevas de
   su mazo personal ese turno.
2. Cartas de acción disponibles (**10 por jugador**, del color de su
   personaje) — desglose definido para esta adaptación (no viene 1:1 del
   manual, que no detalla las cantidades; ver sección 7):
   - **2× Mover izquierda/derecha** (un vagón adelante o atrás, estando en
     el interior; en el techo se puede mover varios vagones de una).
   - **2× Cambiar de piso** (subir/bajar entre interior y techo del mismo
     vagón).
   - **2× Disparar**.
   - **2× Robar** (tomar un ítem del vagón donde estás).
   - **1× Golpear (puñetazo)**.
   - **1× Mover al Marshal** (un vagón, dirección a elección).
3. Cada turno dentro de la fase de Planificación tiene un ícono en la carta
   de ronda que dice cómo se juega ese turno en particular:
   - **Boca arriba** (ícono normal): se juega una carta visible para todos
     apenas se coloca.
   - **Túnel:** la carta de acción de ese turno se juega **boca abajo**, y
     nadie sabe qué es hasta que le toca resolverse en la fase de Acción.
   - **Acelerar:** ese turno, cada jugador juega **dos cartas seguidas**
     (o roba 3 cartas y no juega ninguna, como siempre) en vez de una sola.
   - **Cambio de vía:** a partir de ese turno, el sentido de la ronda de
     turnos pasa a ser **antihorario**, arrancando de nuevo por el Jugador
     Inicial.
4. Se repite la ronda de turnos hasta completar la cantidad de turnos que
   pide la carta de ronda (indicada por sus íconos). Recién ahí se pasa a
   la fase Acción.

> Corrección: lo que antes describía como "invertir el orden de resolución
> dando vuelta el mazo" en realidad son dos cosas distintas y las tenía
> mezcladas. **Dar vuelta el mazo** es simplemente el mecanismo con el que
> el Jugador Inicial revela el mazo de cartas jugadas boca abajo para pasar
> a la fase de Acción — pasa **todas las rondas**, no cambia nada del
> orden. El que sí altera el orden de turno es el ícono **Cambio de vía**
> de la carta de ronda, descripto arriba.

### 4.2 Fase Acción

1. El orden de resolución es el orden en que se apilaron las cartas en la
   fase de Planificación (por turno de jugador, no aleatorio) — no hay
   mezcla ni sorteo en esta fase.
2. Se revela y ejecuta una carta a la vez, aplicando su efecto de inmediato
   (mover ficha, robar ítem, aplicar bala/golpe, mover Marshal). Cada
   jugador, al revelarse su carta, elige los detalles de la acción que
   permita (a quién dispara/golpea, para qué lado se mueve, etc.), sujeto a
   que la acción siga siendo legal en ese momento.
3. Las cartas boca abajo se revelan recién en el momento en que les toca
   ejecutarse — pueden cambiar el resultado esperado de una jugada de otro
   jugador (ej. alguien se mueve a un vagón esperando estar solo, y una
   carta oculta hace que otro llegue antes).
4. Al terminar de ejecutar todo el mazo combinado, se dispara el evento de
   fin de ronda de la carta de ronda actual (ver 4.4), todos los jugadores
   juntan de nuevo sus cartas de acción jugadas (más las balas/neutrales que
   hayan recibido) en un solo mazo personal, y el primer jugador pasa al de
   su izquierda para la ronda siguiente.

### 4.3 Disparar y golpear

- **Disparar (interior):** solo alcanza a un bandido en el interior de un
  vagón **adyacente** (adelante o atrás) — no se puede disparar más lejos
  de un vagón de distancia estando adentro, y no se puede disparar a
  alguien en tu propio vagón.
- **Disparar (techo):** desde el techo alcanza a cualquier bandido en el
  techo de **cualquier otro vagón**, sin límite de distancia, pero la
  **línea de visión se bloquea por otros bandidos** en el medio — hay que
  darle al más cercano en esa dirección. Dos bandidos en el techo del mismo
  vagón cuentan como "lado a lado" (no uno bloqueando al otro): el tirador
  elige a cuál de los dos le da.
- **Efecto del disparo:** el objetivo recibe una de tus cartas de **Bala**,
  que se mezcla en su propio mazo de acción — es una carta muerta que le
  obliga a robar en vez de jugar en un turno futuro. No hace soltar botín
  directamente (a diferencia del puñetazo).
- **Golpear (puñetazo):** cuerpo a cuerpo, mismo vagón y misma capa. **El
  atacante elige** qué ficha suelta la víctima (no la víctima) de entre las
  que tiene sobre su carta de Personaje, y la coloca boca abajo en el piso
  del vagón donde ocurrió — si el atacante elige una bolsa, no puede mirar
  su valor antes de soltarla. Luego el atacante también elige a qué vagón
  adyacente empuja a la víctima (misma capa en la que estaba).
- **Nunca se puede abandonar el tren:** si un disparo (por ej. de Trueno) o
  un evento empujarían a un bandido más allá del último vagón o antes de
  la Locomotora, simplemente no se mueve — se queda donde está.

### 4.4 Eventos de fin de ronda

Las cartas de ronda pueden traer un evento que se dispara **al final de la
ronda**, después de resolver todas las cartas de acción. Estos 8 son los
oficiales:

1. **Marshal furioso:** el Marshal dispara a todos los bandidos que estén
   en el techo de su propio vagón (bala neutral cada uno, del mazo
   compartido de 13). Luego el Marshal avanza **siempre hacia el vagón de
   cola** (dirección fija, no a elección) — si ya está en el último vagón,
   no se mueve.
2. **Brazo giratorio ("Swivel Arm"):** todos los bandidos que estén en un
   techo se mueven al techo del último vagón (cola del tren).
3. **Frenada ("Braking"):** todos los bandidos que estén en un techo se
   mueven un vagón hacia adelante (hacia la Locomotora).
4. **¡Llevátelo todo! ("Take It All!"):** se coloca el segundo maletín
   ($1000) en el vagón donde esté el Marshal en ese momento.
5. **Rebelión de pasajeros:** todos los bandidos que estén en el
   **interior** de un vagón reciben una bala neutral cada uno.
6. **Carterismo ("Pickpocketing"):** cada bandido que esté **solo** en su
   posición puede tomar gratis una bolsa de dinero de ese lugar, si hay
   alguna (no aplica a diamantes ni maletines).
7. **Venganza del Marshal:** cada bandido que esté en el techo justo
   encima del vagón del Marshal pierde la bolsa de **menor valor** que
   tenga en su hoja de personaje.
8. **Secuestro del conductor:** cada bandido que esté en la Locomotora
   (interior o techo) recibe un rescate de **$250**.
9. **Alarma en el tren** _(inventado para esta adaptación, no es del
   original)_: cada bandido que esté en el **techo** de cualquier vagón
   recibe una bala neutral del mazo compartido — contraparte de "Rebelión
   de los pasajeros", que afecta al interior.

### 4.4.1 Layout exacto de cada carta (aportado por vos)

Esto no estaba en el manual ni lo encontré documentado en ningún lado
online — lo transcribo tal cual me lo diste, como referencia directa de las
cartas físicas. Cada fila es una carta de ronda completa: la cantidad de
turnos de Planificación que tiene y qué ícono trae cada turno.

**Set de 5-6 jugadores (5 de las 7 cartas confirmadas):**

| Evento                                  | Turno 1     | Turno 2            | Turno 3                                                    | Turno 4                                                                   | Turno 5     |
| --------------------------------------- | ----------- | ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------- | ----------- |
| **Marshal furioso**                     | Boca arriba | Boca arriba        | Túnel (boca abajo)                                         | Boca arriba + **Cambio de vía** (se invierte el orden de turno desde acá) | —           |
| **Gancho de correo**                    | Boca arriba | Túnel (boca abajo) | Boca arriba                                                | Boca arriba                                                               | —           |
| **Freno**                               | Boca arriba | Boca arriba        | Boca arriba                                                | Boca arriba                                                               | —           |
| **¡A por todas!**                       | Boca arriba | Túnel (boca abajo) | Boca arriba + **Acelerar** (se juegan 2 cartas este turno) | Boca arriba                                                               | —           |
| **Rebelión de los pasajeros**           | Boca arriba | Boca arriba        | Túnel (boca abajo)                                         | Boca arriba                                                               | Boca arriba |
| **Vía libre** _(inventada, sin evento)_ | Boca arriba | Túnel (boca abajo) | Boca arriba                                                | Túnel (boca abajo)                                                        | —           |
| **Silbato de alarma** _(inventada)_     | Boca arriba | Boca arriba        | Boca arriba + **Acelerar**                                 | Túnel (boca abajo)                                                        | —           |

Las últimas 2 son **inventadas por nosotros** para completar el mazo de 7
(no vienen del juego original ni las diste vos, salvo la idea de turnos
1/3 boca arriba y 2/4 boca abajo para "Vía libre", que fue tu sugerencia):

- **Vía libre:** sin evento de fin de ronda — 4 turnos alternando boca
  arriba/Túnel (1 y 3 boca arriba, 2 y 4 boca abajo). Es la única carta del
  mazo que no dispara nada al final de la ronda, lo cual la hace más
  "tranquila" que el resto en términos de amenazas del Marshal.
- **Silbato de alarma:** turno 3 es Acelerar. Evento propio **"Alarma en
  el tren"**: cada bandido que esté en el **techo** de cualquier vagón
  recibe una bala neutral al final de la ronda (del mazo compartido de 13)
  — es la contraparte de "Rebelión de los pasajeros" (que afecta a los que
  están en el interior), pero para el techo.

Con esto el mazo de 7 cartas de ronda (usado para todo el rango 3-6
jugadores, ver sección 4) queda completo.

**Las 3 cartas de "Estación de tren" (ronda final — se elige 1 al azar):**

| Evento                      | Turno 1     | Turno 2     | Turno 3            | Turno 4     |
| --------------------------- | ----------- | ----------- | ------------------ | ----------- |
| **Carterismo**              | Boca arriba | Boca arriba | Túnel (boca abajo) | Boca arriba |
| **Venganza del Marshal**    | Boca arriba | Boca arriba | Túnel (boca abajo) | Boca arriba |
| **Secuestro del conductor** | Boca arriba | Boca arriba | Túnel (boca abajo) | Boca arriba |

Este mazo de 3 ya está **completo** — no faltan más cartas acá, se elige 1
al azar para la 5ª y última ronda de cada partida.

Notas:

- Las 3 cartas de Estación de tren comparten el mismo patrón exacto de
  turnos (1-2-4 boca arriba, turno 3 en Túnel) — solo cambia el evento de
  fin de ronda que disparan.
- "¡A por todas!" es la única con un turno Acelerar (turno 3 se juegan 2
  cartas seguidas), lo que hace que ese turno cuente como 2 cartas jugadas
  aunque la carta tenga 4 "turnos" marcados.
- "Freno" es la única sin ningún turno especial: los 4 turnos son boca
  arriba simples, y su único efecto es el evento de fin de ronda.
- El mazo de 7 cartas de ronda ya está completo y es único para todo el
  rango 3-6 jugadores (ver sección 4 y 7).

### 4.5 Título de Pistolero (bono de fin de partida)

> Esto quedaba como duda en la versión anterior de este documento — el
> manual lo resuelve con precisión, y **no** es "el primero en gastar sus
> balas" como yo había puesto.

- Al terminar la partida, se le otorga el título de **Pistolero** al
  jugador (o jugadores) que haya **disparado la mayor cantidad de balas**
  durante toda la partida — es decir, al que le queden **menos** cartas de
  Bala de su color en mano/mazo al final (no importa a quién le disparó, ni
  cuándo las gastó).
- El o los ganadores del título reciben **$1000** cada uno, sumado directo
  a su botín. Si hay empate, **todos** los empatados cobran el bono
  completo (no se reparte).
- **Desempate del ganador de la partida:** si dos o más jugadores empatan
  en plata total al final, gana el que haya **recibido menos cartas de
  Bala** de otros jugadores y de eventos durante toda la partida (el que
  menos veces lo hirieron).

### 4.6 El Marshal

- Se mueve un vagón por vez (dirección a elección del jugador que jugó la
  carta "Marshal"), o según lo indique un evento de fin de ronda (4.4). No
  cambia de capa (no sube/baja del techo).
- Si termina compartiendo vagón con uno o más bandidos, cada uno de ellos
  recibe una bala neutral y es desplazado al techo de ese mismo vagón.

## 5. Fin de la partida

- La partida se juega a lo largo de **5 rondas** fijas (Planificación +
  Acción cada una), la última usando la carta de "ronda final" en vez de una
  de las 4 cartas de ronda normales sorteadas al arranque (ver sección 4).
- Al terminar la 5ª ronda, cada jugador revela el valor real de todas sus
  bolsas/joyas/maletines (hasta ese momento ocultas a los demás) y suma el
  total, más el bono de $1000 del título de Pistolero si corresponde (ver
  4.5) y cualquier ganancia de eventos de fin de ronda (rescates de $250,
  etc.). Gana quien tenga más; empate se resuelve por menos balas
  recibidas durante la partida (ver 4.5).
- Las balas y golpes recibidos no restan directamente del total — su costo
  real es haber ocupado espacio en el mazo de acción durante la partida
  (una oportunidad perdida de jugar otra carta), más cualquier ítem que se
  haya soltado al recibirlos.

## 6. Cómo encaja en la arquitectura de Juntada

Este proyecto ya tiene resuelto el 90% de lo que hace falta como
infraestructura técnica (WS server, salas, sync de estado, validación en
servidor) — no hace falta construir nada de eso de nuevo. Ver
`backend/src/games/registry.ts` y `frontend/src/games/registry.ts` para el
contrato completo. Puntos concretos para Riel Salvaje:

- **Backend:** un `backend/src/games/riel-salvaje/engine.ts` con
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
  Candidato a vivir en un paquete compartido (`packages/riel-salvaje-*`) si
  se termina haciendo modo local además de online (ver sección 9).
- **Título de Pistolero:** contador por jugador de balas propias
  disparadas (o restantes), se actualiza en el mismo `handleAction` que
  resuelve un disparo; al final de la partida se compara entre todos para
  ver quién disparó más (ver 4.5). Trivial de testear aparte del resto del
  motor.
- **Validación de acciones:** "no podés Robar si no estás en ese vagón",
  "no podés Disparar sin línea de visión", "no podés tocar el maletín con
  el Marshal presente hasta desalojarlo" — todo se valida server-side
  dentro de `handleAction`, nunca confiando en lo que ya validó la UI
  (mismo patrón que el resto de Juntada).

## 7. Decisiones pendientes para cuando se implemente

Confirmado ya contra el manual oficial (consultado en PDF privado, no
guardado en este repo por temas de derechos de autor — ver fuentes al
final): cantidad de vagones por
jugador, Marshal único con mazo compartido de 13 balas neutrales, bolsa
inicial de $250, secreto de bolsas visible solo para el dueño, 26 fichas de
botín (18 bolsas + 6 joyas + 2 maletines), colocación inicial de jugadores,
5 rondas con 4 cartas de ronda al azar + 1 de 3 cartas de "Estación de
tren" para la última, íconos de turno (boca arriba / Túnel / Acelerar /
Cambio de vía), línea de visión de disparo, quién elige qué suelta la
víctima del puñetazo, la regla de "nunca se abandona el tren", los 8
eventos oficiales de fin de ronda (más 1 inventado, "Alarma en el tren"),
las 6 habilidades de personaje (con sus matices:
Sombra pierde la habilidad si roba en su primer turno, Trueno no empuja
fuera del tren, Urraca solo se queda bolsas), el título de Pistolero
(quien más disparó, no quien dispara primero) y el desempate por menos
balas recibidas. También ya definido (decisión propia, ver 4.1): el
desglose de las 10 cartas de acción — 2 Mover, 2 Cambiar de piso, 2
Disparar, 2 Robar, 1 Golpear, 1 Mover Marshal. Además, el set completo de
cartas de ronda (7 cartas: 5 confirmadas + "Vía libre" sin evento +
"Silbato de alarma" con el evento propio "Alarma en el tren") y las 3 de
"Estación de tren" (ver 4.4.1) — se usa **un solo mazo de 7** para todo el
rango 3-6 jugadores, no dos mazos separados como el original (ver
sección 4). Resuelto también:

- **Jugadores: mínimo 3, máximo 6.** No se banca la variante oficial de 2
  jugadores (equipos de 2 personajes) — se descarta directamente. Como el
  máximo es 6 y hay 6 personajes, **nunca hace falta repetir personaje**.
- **Reconexión durante la fase Planificación:** las cartas que un jugador
  ya apiló **quedan como están** si se desconecta — no se congela nada
  especial más allá de lo que el motor genérico de Juntada ya maneja
  (`useMultiplayerSocket.ts`); al reconectar retoma la partida en el mismo
  punto.
- **Modo local:** no se implementa por ahora — se prioriza que el modo
  online funcione completo primero. Se reevalúa más adelante si tiene
  sentido un modo pass-and-play (la fase de Planificación oculta es más
  compleja de resolver en un solo dispositivo compartido).
- **Todos arrancan en el interior de "su" vagón** (el n-ésimo detrás de la
  Locomotora), ninguno en la Locomotora ni en un techo — la posición inicial
  no venía detallada en este documento y quedó como decisión propia.
- **Habilidades opcionales de las reglas implementadas como automáticas
  (decisión consciente):** Sombra "puede" jugar boca abajo en su primer
  turno y Carterismo deja "tomar" gratis una bolsa — en ambos casos el motor
  (`backend/src/games/riel-salvaje/rules.ts`) lo hace automático en vez de
  ofrecer una elección real, porque casi nunca hay razón para no usarlas y
  una elección real pediría UI/interacción nueva para un caso de bajo
  impacto. Si en algún momento se quiere la elección real, hay que agregar
  un parámetro a `playPlanningCard` (Sombra) y una sub-fase de confirmación
  al evento (Carterismo).
- **Entre 2 y 5 bolsas/joyas por vagón de carga** (no la Locomotora),
  decisión confirmada con el usuario. El pool de 18 bolsas + 6 joyas sigue
  existiendo entero (variedad de valores), pero **no hace falta usarlo
  completo cada partida** — con pocos jugadores (menos vagones) sobran
  fichas sin colocar esa partida, y no pasa nada. Implementado en
  `distributeCargo` (`backend/src/games/riel-salvaje/rules.ts`,
  `MIN_ITEMS_PER_WAGON`/`MAX_ITEMS_PER_WAGON`).

Lo que sigue sin decidirse:

- **Set de cartas de ronda separado para 3-4 vs. 5-6 jugadores (como el
  original):** ya no aplica — al usar un solo mazo de 7 para todo el rango
  3-6, no hace falta un segundo set. Si en algún momento se quiere
  diferenciar el ritmo de partidas de 3-4 jugadores del de 5-6, ahí sí
  habría que retomarlo.

## 8. Orientación de pantalla (landscape)

A diferencia del resto de los juegos de Juntada (todos pensados para
portrait, un teléfono parado), Riel Salvaje se juega mejor en horizontal:
el tren es el elemento central del tablero y necesita ancho para mostrar
varios vagones a la vez con su techo y su interior legibles.

Flujo de pantalla sugerido:

1. **Lobby y selección de personaje:** en portrait, como el resto de
   Juntada (consistencia con el flujo genérico de sala).
2. **Transición al arrancar la partida:** pantalla intermedia de
   "🔄 girá tu teléfono", antes de mostrar el tablero.
3. **Tablero de juego (landscape):** HUD arriba con plata actual del
   jugador (revelada recién al final de la partida — mientras tanto muestra
   cantidad de ítems boca abajo que lleva encima), balas propias restantes
   (con aviso visual al llegar a 0, ver sección 4.5). El tren ocupa el
   centro con scroll horizontal — cada vagón muestra una "tapa" de techo
   (ocupantes, Marshal/maletín si aplica) sobre el cuerpo del vagón (botín
   boca abajo ítem por ítem, ocupantes del interior). La mano de cartas de
   la fase Planificación queda fija a un costado, siempre visible.
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

- Cantidad de jugadores: **mínimo 3, máximo 6** (no se banca la variante
  oficial de 2 jugadores, ver sección 7).
- Cantidad de vagones según jugadores (sección 2) — fija por cantidad de
  jugadores, no un mapa elegible.

## Fuentes consultadas (2026-07-27)

Reglas oficiales del juego de mesa en el que se inspira este diseño
(Christophe Raimbault / Ludonaute, 2014), usadas únicamente para verificar
mecánicas de juego (no protegidas por derecho de autor) — nunca para copiar
texto, arte o nombres propios (esos sí están protegidos, por eso "Riel
Salvaje" y los 6 nombres de personaje son propios, ver sección 3):

- Manual oficial en PDF — consultado en privado, **no se guarda en este
  repo** por ser un documento con copyright de terceros (ver nota al
  principio del documento).
- [How to play — Official Rules | UltraBoardGames](https://www.ultraboardgames.com/colt-express/game-rules.php)
- [The events | UltraBoardGames](https://www.ultraboardgames.com/colt-express/events.php)
- [The Action Cards | UltraBoardGames](https://www.ultraboardgames.com/colt-express/action-cards.php)
- [The Bandits | UltraBoardGames](https://www.ultraboardgames.com/colt-express/bandits.php)
