# Rayado Libre — rediseño visual (plan completo)

## Cómo leer este documento

La fuente de verdad es `docs/referencias/rayado-libre-referencia-v2.html`.
Abrilo en el navegador y leé su CSS y su script enteros antes de planear cada
fase. Colores, tamaños, tiempos, curvas de animación y textos se toman de ahí.

La consigna es **aplicar TODO lo que tiene la referencia**, salvo lo que está
en la lista de "Qué NO va". Cada punto de las listas de abajo es obligatorio.

- Si un punto no se puede implementar tal cual, no lo omitas ni lo
  simplifiques por tu cuenta: frená y preguntame.
- "Queda para después", "es opcional" o "no aporta" no son motivos válidos
  para saltear algo.
- Al cerrar cada fase entregá el checklist de esa fase punto por punto, con ✓
  y el archivo donde quedó cada cosa. Un punto sin ✓ es una fase sin terminar.

## Qué NO va

1. **El título del juego arriba.** En la referencia es el `<header>` con el
   logo "Rayado Libre" y la pastilla "referencia v2". El nombre ya está en el
   navbar de la app.
2. **El bloque de bienvenida del comienzo.** Es el panel `#start` con
   "Empezar" y la nota del reloj acelerado.
3. **Lo que es solo andamiaje de la demo y no del juego:**
   - el botón "Ver como celular" y el marco de celular (`body.frame`);
   - el reloj acelerado (`SEC_MS = 420`): el tiempo real lo maneja el servidor;
   - los rivales simulados (guiones de mensajes, aciertos por "tinta", el
     dibujo precargado de la casa);
   - la lista de palabras de ejemplo (`WORD_BANK`): se usa
     `@juntada/rayado-libre-data` y la configuración del juego;
   - los nombres Lucía, Tomi y Nacho, y los 12 segundos de elección de
     palabra: se usan los jugadores y tiempos reales.

   Los EFECTOS que la demo muestra con esos datos falsos sí van, conectados a
   los datos reales. Por ejemplo, el marcador que sigue el trazo de Lucía se
   aplica al trazo real que llega por WebSocket.

## Qué no cambia

- Reglas y puntaje: `@juntada/rayado-libre-scoring` queda igual.
- El flujo de fases del motor (choosing → drawing → reveal → result), salvo
  los dos agregados de backend de la fase 3.
- El modo local sigue funcionando. Todo lo visual que aplique (tablero,
  paleta, cabecera, revelación, tabla, podio) también se aplica en local. El
  chat no existe en local: ahí sigue la lista manual de "¿quién acertó?", con
  el mismo estilo nuevo.

## Requisitos transversales (todas las fases)

- **Tamaños a verificar:** compu 1440×900, celular 390×800, celular chico
  320×568 y celular horizontal 844×390, en los dos roles (dibujante y
  adivinador). Con Playwright, antes de cerrar cada fase.
- **Layouts:** dependen del ancho del contenedor del juego, no de la pantalla.
  - Usar container queries (plugin `@container` de Tailwind o CSS propio).
  - Cortes: `min-width: 700px` para 2 columnas y `min-width: 1000px` para 3
    columnas, `max-width: 359px` para celular chico, y
    `(orientation: landscape) and (max-height: 520px)` para celular
    horizontal dibujando.
- **Movimiento reducido:** todas las animaciones respetan
  `prefers-reduced-motion`, como en la referencia.
- **Vibración:** es un extra, nunca información necesaria. En iPhone no existe
  `navigator.vibrate`.
- **Sonido:** arranca después de un gesto del usuario, lleva botón de
  silencio que se recuerda, y se genera con Web Audio (sin archivos).
- **Volver de otra app:** al volver, se muestra el estado actual sin
  reproducir animaciones atrasadas.
- **Rendimiento:** probar con CPU ×4 más lenta en Chrome DevTools. Nada de
  `blur` animado ni sombras animadas en loops.

---

## Fase 1 — Layout responsivo, cabecera de turno y tablero

Rama: `feat/rayado-layout` desde `staging`.

### Layout

- [ ] **Compu (≥1000 px):** grilla de 3 columnas, `230px | tablero | 340px`,
      separación 18 px.
- [ ] **Tablet o celular horizontal (700–999 px):** 2 columnas,
      tablero y chat de 280–340 px.
- [ ] **Celular (<700 px):** apilado, con el tablero arriba y el chat abajo
      ocupando el resto.
- [ ] **Tamaño del tablero:** cuadrado, limitado por ancho y por alto con
      `--board-max`, con estos valores:

  | Formato    | Adivinando       | Dibujando        |
  | ---------- | ---------------- | ---------------- |
  | Celular    | `56dvh`          | `100dvh - 330px` |
  | 2 columnas | `100dvh - 150px` | `100dvh - 250px` |
  | Compu      | `100dvh - 180px` | `100dvh - 300px` |

- [ ] **Celular horizontal dibujando:** el tablero ocupa `100dvh - 118px` con
      la paleta en columna al costado. La paleta en sí se implementa en la
      fase 2, pero el lugar queda reservado ahora.
- [ ] **Teclado en celular:** el viewport incluye
      `interactive-widget=resizes-content`, así en Android el tablero se
      achica cuando se abre el teclado.

### Lista de jugadores (compu)

- [ ] Panel "Jugadores", ordenado por puntaje, con avatar, nombre y puntos.
- [ ] Estado por jugador: "✏️ dibujando" (fondo violeta), "✓ adivinó · +N"
      (fondo verde) y "escribiendo" con puntitos animados. El dato de
      "escribiendo" llega en la fase 3; el estado visual se deja listo ahora.

### Cabecera del turno

- [ ] Avatar del dibujante, texto de rol y cantidad de letras ("Dibuja X ·
      adiviná la palabra (4 letras)" / "Dibujás vos · los demás adivinan").
- [ ] **Pista:** letras con subrayado de color, en Permanent Marker. Las
      letras reveladas caen con rebote (`translateY(-12px) scale(1.5)` → 0,
      500 ms, con amarillo al aparecer). Para el dibujante se ve la palabra
      entera con subrayado verde.
- [ ] **Reloj:** anillo arcoíris (`conic-gradient`) que se vacía, animado con
      `@property --p`. En los últimos 10 segundos late, con sonido y
      vibración corta.
- [ ] **Salto del reloj** (primer acierto en cada zona): el número baja
      contando, el anillo gira y se agranda, y aparece el cartel amarillo
      "¡El reloj saltó a N!" durante 1,8 s. Suena un barrido descendente.
- [ ] En compu la cabecera va centrada, con letras de 26 px y anillo de
      64 px.

### Tablero

- [ ] Hoja de papel `#fbf7ee` con textura de ruido SVG, levemente torcida
      (`rotate(-.5deg)`), sombra, y dos tiras de cinta en las esquinas.
- [ ] **Dibujo remoto:** mientras llegan los trazos de otro jugador, un
      marcador SVG sigue la punta del trazo, con la tapa del color actual. Se
      oculta cuando no llegan trazos.
- [ ] **Tablero vacío del dibujante:** texto "Dibujá PALABRA acá" en
      marcador. Se desvanece con el primer trazo.

### Checklist de cierre

- [ ] Todo lo anterior, verificado en los 4 tamaños y en los 2 roles.
- [ ] Modo local con el mismo tablero y la misma cabecera.
- [ ] El `<header>` con el título del juego NO está.

---

## Fase 2 — Paleta de herramientas

Rama: `feat/rayado-paleta` desde `staging`.

### Estructura

- [ ] **Fila 1:** los 9 colores de hoy como tapitas de marcador (esquinas
      9/9/13/13, sombra interior inferior). El blanco lleva borde. - La tapita elegida sube 6 px con rebote y muestra un puntito blanco
      debajo. - Al tocar una tapita suena un "tac" y, si estaba la goma, se vuelve al
      lápiz.
- [ ] **Fila 2:** - selector de grosor (4, 10 y 20), donde el puntito toma el color
      actual; - selector Lápiz / Goma / Balde (en compu con etiqueta de texto, en
      celular solo el ícono); - a la derecha, Deshacer (deshabilitado si no hay nada) y Borrar.
- [ ] **Borrar con confirmación:** el primer toque convierte el botón en
      "¿Borrar?" en rojo por 2,5 s; el segundo toque borra. Al borrar, la hoja
      tiembla y el dibujo se desvanece, con sonido de salpicadura.
- [ ] Todo con roles ARIA de `radiogroup` / `radio` y `aria-checked`, y
      tooltips con el atajo de cada herramienta.

### Compu

- [ ] **Cursor:** un círculo SVG del tamaño y color real del trazo, escalado
      al tamaño del tablero en pantalla. La goma es un círculo sin relleno y
      el balde, `crosshair`.
- [ ] **Atajos:** 1–9 colores, B lápiz, E goma, G balde, [ y ] grosor,
      Ctrl/Cmd+Z deshacer. Se ignoran si el foco está en un input. Debajo de
      la paleta va una línea que los muestra.

### Celular chico y horizontal

- [ ] **Celular chico (<360 px):** botones más angostos para que entre todo
      sin cortar Borrar. Verificar a 320 px.
- [ ] **Celular horizontal dibujando:** la paleta pasa a 2 columnas
      verticales al costado del tablero, con las tapitas en columna (la
      elegida se corre hacia la derecha) y las herramientas en columna.

### Comportamiento y otros

- [ ] **Balde con tolerancia:** relleno por líneas con tolerancia (90 en la
      referencia) para cubrir los bordes suavizados de los trazos, sin dejar
      huecos blancos en los bordes. Suena un "blop".
- [ ] **Sonido de dibujo:** mientras se dibuja, un garabato de marcador
      (ruido filtrado) cuyo volumen y tono siguen la velocidad del trazo.
- [ ] **"Pedir otra palabra":** pastilla debajo de la palabra. Al usarla, la
      palabra gira en X al cambiar. Desaparece al usarla o con el primer
      acierto (misma regla que hoy).

### Checklist de cierre

- [ ] Todo lo anterior, verificado en los 4 tamaños.
- [ ] Modo local con la misma paleta.

---

## Fase 3 — Chat de respuestas (frontend y backend)

Rama: `feat/rayado-chat` desde `staging`.

### Frontend

- [ ] **Panel "Respuestas":** a toda altura en compu y 2 columnas; en celular
      ocupa el espacio que queda.
- [ ] **Cabecera del panel:** fichitas verdes de quién adivinó, con avatar y
      "+N", que aparecen con rebote. Al lado, el contador "2/3 ✓".
- [ ] **Historial completo con scroll.** Se deja de recortar a 5 mensajes en
      vivo. - Si el usuario está abajo, cada mensaje nuevo lo lleva al final. - Si subió a leer, no se lo mueve: aparece el botón "↓ N nuevos", que
      baja suave. - El scroll no se propaga a la página (`overscroll-behavior: contain`).
- [ ] **Mensajes propios:** a la derecha, en burbuja violeta, sin nombre.
- [ ] **Mensajes de otros:** a la izquierda, con avatar y nombre en su color.
- [ ] **Aciertos:** línea centrada verde ("Tomi adivinó · +60" / "¡Adivinaste!
      · +N") sin revelar la palabra.
- [ ] **Mensajes del sistema:** centrados, en itálica gris ("X está
      dibujando…").
- [ ] **Mensaje "cerca":** burbuja amarilla con "¡Estás cerca! · solo lo ves
      vos", y el input tiembla.
- [ ] **Indicador de escritura:** "Tomi está escribiendo…" / "Tomi y Nacho
      están escribiendo…" con puntitos animados, debajo del chat. El mismo
      estado se ve en la lista de jugadores de compu.
- [ ] **Entrada de mensajes:** - input con `enterkeyhint="send"`, fijo al pie del panel; - al adivinar, el input queda verde y deshabilitado con "¡Era PALABRA!
      Esperá al resto…" y el botón Enviar desaparece; - el dibujante ve el chat sin input.

### Backend (`backend/src/games/rayado-libre/engine.ts`)

- [ ] **Evento "escribiendo":** el cliente lo manda como mucho una vez cada
      2 s mientras hay texto. El servidor lo reenvía a los demás y el estado
      se apaga solo a los ~4 s sin eventos nuevos. No se manda cuando el
      jugador ya adivinó ni cuando es el dibujante.
- [ ] **"Cerca":** si un intento incorrecto está a distancia de edición 1 de
      la palabra normalizada, o es un prefijo de más de 3 letras, el servidor
      marca ese mensaje como "cerca" SOLO en lo que le manda a quien lo
      escribió. Los demás lo ven como mensaje normal.
- [ ] Tests unitarios de los dos agregados, incluido que "cerca" nunca le
      llegue a otros jugadores.

### Checklist de cierre

- [ ] Todo lo anterior, más un e2e online de dos jugadores que cubra el
      indicador de escritura y el mensaje "cerca" (visible solo para quien lo
      escribió).

---

## Fase 4 — Efectos, pantallas de elección, revelación y podio

Rama: `feat/rayado-efectos` desde `staging`.

### Acierto

- [ ] **Acierto de otro:** salpicadura de tinta del color del jugador junto a
      su línea del chat, y los puntos flotan hacia el reloj. Si el dibujante
      sos vos, dice "+10 para vos". Suena un ding doble y vibra corto.
- [ ] **Acierto propio:** - "¡Adivinaste!" gigante girado, con "+N puntos"; - salpicaduras arcoíris sobre el tablero y 40 papelitos de confeti; - arpegio de 4 notas y vibración `[30, 40, 80]`; - la pista se completa con subrayado verde.

### Elegir palabra

- [ ] **Abanico de 3 cartas de papel,** con franja de color arriba, palabra en
      marcador y categoría debajo. - Entran desde abajo, una tras otra, con sonido de carta. - Con el mouse encima, se levantan. - Al elegir, la carta sube y se achica; las otras caen giradas.
- [ ] Texto de cuenta regresiva "Se elige sola en Ns", con el tiempo real
      del juego.

### Revelación

- [ ] "La palabra era" y una pincelada arcoíris que se pinta de izquierda a
      derecha. Después aparece la palabra en blanco, destapándose con
      `clip-path`. El tamaño de letra es `clamp(34px, 11vw, 52px)` para que
      no se corte en celular.
- [ ] **Tabla del turno:** - filas que entran escalonadas, con el motivo de cada puntaje
      ("adivinó con 57s", "+10 por cada acierto", "no adivinó"); - el "+N" cuenta hacia arriba, después el total; - la tabla se reordena animada, desplazando cada fila desde su posición
      anterior.

### Podio final

- [ ] Barras de colores del arcoíris con alturas 58/82/42 %, que crecen en el
      orden 3.º, 2.º, 1.º. Los avatares caen y aparece la corona 👑 sobre el
      primero.
- [ ] Si ganaste: fanfarria, vibración y confeti. Si no, un ding.

### Sonidos (todos sintetizados como en la referencia)

- [ ] mensaje recibido, mensaje propio, cerca, acierto de otro, acierto
      propio, salpicadura, salto del reloj, latido, carta, clic, tapita,
      balde, conteo, fin de turno y fanfarria.

### Checklist de cierre

- [ ] Todo lo anterior, verificado en los 4 tamaños.
- [ ] Modo local con elección, revelación, tabla y podio nuevos.

---

## Reglas de trabajo

- Seguir `CLAUDE.md`: plan primero, archivos chicos y componentes separados
  (no hacer crecer `RoundView` ni `LocalGame`), commits convencionales en
  español, sin co-author.
- Una rama y una PR a `staging` por fase, en orden. No commitear ni pushear
  sin que lo pida.
- Al terminar cada fase:
  - correr `pnpm lint`, `pnpm format:check`, el typecheck de frontend y
    backend, los tests unitarios tocados y `pnpm test:e2e`;
  - probar en el navegador en los 4 tamaños y en local y online;
  - entregar el checklist de la fase con ✓ y archivo por punto;
  - explicar en pocas líneas las decisiones no obvias, para que yo pueda
    defender el código.
