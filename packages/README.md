# Packages

Lógica pura (sin React, sin Express, sin `ws`) compartida entre el motor del
backend (la versión online, con servidor real, de un juego) y el modo local
pasa-y-juega del frontend (el mismo juego jugado en un solo dispositivo, sin
servidor) — y, en el caso de `shared-types`, entre el cliente y el servidor
mismos. Cada paquete es un workspace de pnpm, importado como
`@juntada/<nombre>`.

Por qué existe esto: las reglas de un juego solían implementarse dos veces —
una en el motor del backend, otra en el `LocalGame.tsx` del frontend — y las
dos copias se desincronizaban en silencio cada vez que solo un lado recibía
un arreglo. Poner la matemática/datos puros en un paquete que ambos lados
importan significa que hay exactamente un lugar donde cambiar una regla, y
tanto la versión online como la local de ese juego se actualizan juntas,
automáticamente.

## Transversal (no atado a un juego en particular)

- **`shared-types`** — el contrato de comunicación entre cliente y servidor
  (schemas de `zod` + los tipos derivados de ellos) y cualquier otro tipo de
  TypeScript transversal entre juegos. La única fuente de verdad para
  cualquier cosa que cruce la frontera cliente/servidor.
- **`core-utils`** — helpers genéricos chicos sin significado específico de
  ningún juego (por ahora solo `shuffle`, el único Fisher-Yates usado donde
  sea que se necesite un orden aleatorio justo).

## Un paquete por juego con reglas/datos compartidos

Cada uno de estos tiene la lógica pura de exactamente un juego — ver el
comentario de encabezado de cada `index.ts` para el razonamiento puntual:

- `impostor-data`, `impostor-match-rules`
- `quien-soy-data`
- `rayado-libre-data`, `rayado-libre-scoring`
- `limon-limon-deck`
- `sintonia-data`, `sintonia-scoring`
- `tateti-board`
- `torneo-futbol-bracket`
- `tutifruti-data`, `tutifruti-words`
- `color-correcto-scoring`
- `recamara-engine` — la única excepción que es un motor de reglas completo
  (no solo datos/matemática de puntaje), ya que la máquina de estados turno
  a turno de Recámara se comparte entera tal cual entre local y online, en
  vez de que cada lado maneje su propia copia.

## Si necesitás cambiar algo

- ¿Una regla/dato compartido de un juego está mal en local y online a la
  vez? → probablemente esté en el paquete propio de ese juego acá, no
  duplicado en `backend/src/games/<juego>/` o `frontend/src/games/<juego>/`.
- ¿Un helper genuinamente genérico (no específico de ningún juego) que está
  duplicado en más de un lugar? → pertenece a `core-utils`, no reimplementado
  por paquete (ver `rayado-libre-data`/`rayado-libre-scoring`, que ambos
  importan `shuffle` de acá en vez de tener cada uno su propia copia).
- ¿Agregar un paquete nuevo? → dale su propio `package.json` (`"name":
"@juntada/<nombre>"`, `"main"`/`"types": "index.ts"`), y declará
  explícitamente ahí cualquier dependencia entre paquetes (ver la
  dependencia de `rayado-libre-scoring` sobre `tutifruti-words` para el
  patrón) en vez de importarla implícitamente.
