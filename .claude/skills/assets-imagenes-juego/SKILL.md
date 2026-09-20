---
name: assets-imagenes-juego
description: Gestiona el arte propio de un juego (logo, background/backdrop) en frontend/src/games/<juego>/assets/ — convención de nombre, conversión obligatoria a webp con cwebp, y cómo enchufarlo en GameDef y GameTheme. Usar SIEMPRE que el usuario pegue archivos de imagen sueltos en la carpeta de un juego, o mencione agregar/reemplazar el logo, el background o la imagen de fondo de un juego (propio o de picker), incluso si no pide explícitamente "optimizar" o "convertir".
---

# Assets de imagen por juego

Cada juego con arte propio (logo, background) sigue el mismo patrón que ya usan `impostor` y
`recamara` — no inventar una ubicación o formato nuevo por juego.

## Dónde van y cómo se llaman

- Carpeta: `frontend/src/games/<juego>/assets/`.
- Nombre fijo, minúsculas, sin sufijo del juego (la carpeta ya lo identifica):
  `logo.webp`, `background.webp`. No usar `Logo-<juego>.jpg` ni mayúsculas.
- Si el usuario pega un `.jpg`/`.png` suelto directo en la carpeta del juego (no en `assets/`),
  es la señal de que hay que aplicar este flujo: no lo dejes ahí ni lo importes tal cual.

## Conversión obligatoria a webp

Nunca importar el jpg/png original. Convertir siempre primero:

```bash
cwebp -q 85 Logo-recamara.jpg -o assets/logo.webp
cwebp -q 85 Background-recamara.jpg -o assets/background.webp
```

`cwebp` ya está instalado en el sistema (`webp-tools`). Calidad 85 es el punto ya validado en
este repo (recamara: 2.2MB→228KB, 2.8MB→460KB) — no bajar de ahí sin revisar visualmente el
resultado. Borrar el jpg/png original una vez confirmada la conversión; no dejar ambos.

## Cómo engancharlo en el código

En `frontend/src/games/<juego>/index.tsx`, importar como módulo ES (Vite ya tipa `*.webp` vía
`vite/client` en `vite-env.d.ts`, no hace falta declarar nada) y asignarlo a los campos ya
existentes en `GameDef` (`frontend/src/games/gameTypes.ts`):

```ts
import logo from "./assets/logo.webp";
import backgroundImage from "./assets/background.webp";

export const miJuegoGame: GameDef = {
  // ...
  logo, // reemplaza el emoji `icon` en header/GameDetailDialog
  backgroundImage, // preview de GameDetailDialog al tocar la card
};
```

Si además el juego tiene un `gameTheme` propio en `frontend/src/theme/gameThemes.ts`, el logo
puede reusarse como marca de agua de pantalla completa vía `backdropImage` en `GameTheme`
(tiene prioridad sobre `backdropEmoji`; ver `AppBackdrop.tsx`) — preferí arte oscuro/casi
transparente ahí, porque se renderiza tenue sin tinte.

## ¿Local o servicio externo?

Local, en el repo. Vite importa estos webp como asset estático: los hashea y cachea en el build
igual que cualquier otro chunk, sin infra adicional. Un CDN/S3 solo se justifica si el total de
assets de imagen del proyecto crece a varios MB reales o si se necesita reemplazar arte sin
rebuild — ninguno de los dos es el caso hoy (cada asset webp pesa ~200–500KB). No proponer
migrar a un servicio externo salvo que esa condición aparezca.
