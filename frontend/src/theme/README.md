# Tema

El look por defecto de la app, más la maquinaria que le permite a un juego
puntual reemplazarlo por su propia paleta. Ver también la entrada de
`useGameTheme.ts` en `hooks/README.md` — ese es el hook que efectivamente
aplica todo lo que se describe acá.

- **`styles.ts`** — `S`, el diccionario de estilos inline que usa casi toda
  pantalla (`S.card`, `S.btn(...)`, `S.label`, ...). Dividido en dos
  secciones: los tokens compartidos por (casi) todo juego/pantalla arriba, y
  los tokens usados solo por la pantalla de inicio
  (`AppHeader`/`GamePicker`/`ModePicker`) abajo — ver los comentarios de
  sección dentro del archivo.
- **`sharedChrome.css`** — las variables CSS `--jt-*` que leen `CodeDisplay`,
  `QRDialog`, y las variantes "success"/"ghost" de `S.btn` en vez de un
  color hardcodeado, con los valores por defecto del look normal de la app
  seteados en `:root`. Un juego con tema propio solo sobreescribe un puñado
  de variables base (acento, superficie, texto muted); todo lo demás acá
  deriva de esas automáticamente vía `color-mix`.
- **`gameThemes.ts`** — `GAME_THEMES`, una entrada por juego con tema propio
  (paleta, `backdropEmoji`/`backdropImage` opcionales). Un juego se suma
  seteando `gameTheme: "<clave>"` en su `GameDef` (ver `games/gameTypes.ts`)
  — no hace falta cambiar nada más para que ese juego adopte su propio look
  en todos los componentes compartidos.
- **`curtain.css`** — el overlay de fundido a negro que reproduce
  `hooks/useCurtainTransition.ts` al entrar/salir de cualquier juego (con
  tema propio o no), para que el cambio de pantalla nunca se vea como un
  corte brusco. Un juego con tema propio además cambia la paleta detrás de
  esta misma cortina.
- **`screenTransitions.css`** — la animación que reproduce `<ScreenFade>`
  (`components/ui/ScreenFade.tsx`) al cambiar de paso dentro de una pantalla.
- **`homeDesign.css`** — layout/breakpoints propios de la pantalla de inicio
  (`App.tsx`/`GamePicker`), no pensado para reutilizarse fuera de ahí.
- **`modeRow.css`** — la micro-animación de hover de una "fila de modo"
  (`.jt-mode-row`), compartida entre `ModePicker` y `MenuScreen` — vive acá
  en vez de en `components/` porque ninguno de los dos es dueño exclusivo.

## Cómo se aplica de verdad el look de un juego con tema propio

1. El juego setea `gameTheme: "impostor"` en su `GameDef`.
2. `useGameTheme.ts` busca `GAME_THEMES.impostor` y calcula las variables
   CSS `--jt-*` + los colores de acento/muted del header a partir de eso.
3. `App.tsx` aplica esas variables en su elemento raíz mientras ese juego
   está en pantalla (`inGameView`) — todo componente compartido que lea
   `--jt-*` (en vez de un color hardcodeado) adopta la nueva paleta
   automáticamente, sin necesidad de un branching por componente.
4. Cualquier cosa que las pantallas _propias_ del juego necesiten más allá
   de eso (ej. colores hardcodeados dentro de sus propios componentes) es
   responsabilidad de ese mismo juego — ver los archivos propios de ese
   juego, esta capa solo cubre el chrome compartido.

## Si necesitás cambiar algo

- ¿El look por defecto (sin tema) de la app? → `styles.ts` y/o los valores
  por defecto de `:root` en `sharedChrome.css`.
- ¿Agregar o ajustar la paleta de un juego con tema propio? → `gameThemes.ts`.
- ¿El timing/look de la transición de cortina? → `useCurtainTransition.ts` /
  `curtain.css`.
