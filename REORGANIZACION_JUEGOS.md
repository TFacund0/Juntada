# Guía para reorganizar un juego (separación de archivos, mantenibilidad)

Este documento nace de la reorganización que se hizo sobre **Recámara**
(`frontend/src/games/recamara/` + `packages/recamara-engine/`). Sirve como
prompt reutilizable para pedir lo mismo sobre cualquier otro juego del
repo: qué principios seguir, en qué orden, y cómo verificar que nada se
rompió en cada paso.

## Objetivo

Que cada juego quede organizado así:

- **Motor de reglas puro** (`packages/<juego>-engine/`, si el juego lo
  tiene) — tipos + funciones sin React, sin timers, sin animación.
  Compartido tal cual entre el modo local y el modo online, para que las
  reglas nunca vivan duplicadas en dos lugares.
- **Componentes de UI** en `components/` — uno por pieza visual reusable
  (tokens de jugador, modales, overlays, tarjetas de ronda, etc.), no todo
  amontonado dentro del componente de pantalla completa.
- **Hooks compartidos** para cualquier lógica de animación/temporización
  que se repita entre el modo local y el online (por ejemplo: la
  secuencia de apuntar/disparar/recoil, un countdown que auto-avanza).
  Si detectás el mismo `useState`/`useEffect` copiado en dos archivos,
  ahí hay un hook esperando salir.
- **CSS dividido por área** en vez de un solo archivo gigante — un archivo
  por sección visual (tablero/arena, overlays, botones, animaciones,
  etc.), importados desde un `archivo.css` índice.
- **Tipos y helpers puros** (geometría, temporización, formateo) en sus
  propios archivos chicos (`arena.ts`, `timing.ts`, etc.), no mezclados
  dentro del componente de React.

## Principios

1. **Nunca duplicar reglas entre local y online.** Si algo decide "qué
   pasa" en el juego (daño, turnos, ítems, condiciones de victoria), vive
   en el motor compartido. El componente local y el online solo lo
   _llaman_ y lo decoran con la puesta en escena (animación, sonido,
   texto).
2. **Separar por tipo de responsabilidad, no por tamaño.** Un archivo de
   150 líneas que mezcla lógica de negocio + estado de animación + JSX es
   peor que tres archivos de 50 líneas cada uno con una responsabilidad
   clara.
3. **Extraer un hook solo cuando hay duplicación real**, no
   preventivamente. Si el modo local y el online resuelven una misma
   pantalla de forma estructuralmente distinta (uno imperativo, otro
   reactivo por estado de servidor), forzar un hook común puede salir
   peor que dejarlos separados — evaluar caso por caso antes de unificar.
4. **Nunca cambiar comportamiento durante una reorganización.** Un
   refactor de organización no debería alterar lo que el jugador ve o
   siente (salvo que se pida explícitamente un fix de paso). Si al mover
   código aparece un bug preexistente, arreglarlo aparte y avisarlo, no
   colarlo en el mismo paso silenciosamente.
5. **Pasos chicos, verificados uno por uno.** Nunca mover/reescribir todo
   de una — dividir en fases claras, cada una con su propia verificación
   (tests + typecheck + build) antes de pasar a la siguiente.

## Proceso sugerido (por fases)

1. **Auditoría rápida**: leer los archivos del juego y anotar qué se
   repite entre modo local/online, qué archivo mezcla demasiadas cosas,
   y qué tan grande es el CSS. Proponer un plan de fases concreto antes
   de tocar nada (qué se separa, en qué orden, por qué cada fase es de
   bajo riesgo).
2. **Fase de CSS** (si aplica): dividir el CSS monolítico en archivos por
   sección, respetando el orden de las reglas si hay algo que dependa del
   orden en la cascada (dos selectores de igual especificidad aplicados
   al mismo elemento). Verificar con un diff línea por línea contra el
   original que no se perdió ni se duplicó nada, y correr un build de
   producción para confirmar que el bundler resuelve bien los imports.
3. **Fase de hooks compartidos**: identificar el `useState`/`useEffect`
   duplicado entre local y online (la animación de una acción, un
   countdown, un timer de transición) y extraerlo a un hook con una API
   clara. Actualizar ambos consumidores, correr tests y typecheck.
4. **Fase de reveal/flujo específico de cada modo** (si aplica): evaluar
   si de verdad conviene unificarlo (ver principio 3) o si es mejor
   dejarlo separado y solo documentar por qué.
5. **Verificación final**: typecheck completo, toda la suite de tests del
   juego, y build de producción. Recién ahí dar la fase por cerrada.

## Cómo pedirlo (prompt para copiar y pegar)

> Quiero que reorganicemos el juego **`<nombre-del-juego>`**
> (`frontend/src/games/<carpeta>/`[ + `packages/<carpeta>-engine/`, si
> tiene motor compartido]) siguiendo el mismo criterio que usamos en
> Recámara: separar el motor de reglas puro, los componentes de UI, los
> hooks compartidos de animación/temporización entre modo local y online,
> y dividir el CSS por secciones — sin cambiar el comportamiento actual
> del juego. Primero hacé una auditoría rápida y proponeme un plan por
> fases (qué se separa, en qué orden, por qué cada fase es de bajo
> riesgo) antes de tocar código. Después andá fase por fase, cada una
> chica y verificada (tests + typecheck + build) antes de seguir con la
> siguiente, así no se rompe nada en el camino.

Reemplazá `<nombre-del-juego>`/`<carpeta>` según corresponda. Si el juego
no tiene modo online, aclaralo (el plan cambia: no hay nada que unificar
entre dos modos, el foco pasa a separar motor/UI/estilos nomás).
