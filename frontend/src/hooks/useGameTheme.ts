import { useEffect, type CSSProperties } from "react";
import { GAME_THEMES } from "../theme/gameThemes";
import type { GameDef } from "../games/gameTypes";

/**
 * Calcula el reskin de toda la app (ver `gameTheme` en `GameDef`,
 * `theme/gameThemes.ts`) para el juego que esté actualmente en pantalla, y
 * mantiene sincronizados el fondo del `<body>` y el meta tag `theme-color`
 * con ese tema.
 *
 * @param game juego actualmente seleccionado (o `null`/`undefined` si
 *   ninguno).
 * @param inGameView controla cuándo el reskin está realmente activo: el
 *   cambio de paleta de un juego con tema propio solo debe aplicarse una vez
 *   que su `LocalGame`/`RoundView` está genuinamente en pantalla
 *   (`mode === "local"`, o ya unido a una sala online) — no apenas se lo
 *   elige en la lista de juegos.
 */
export function useGameTheme(game: GameDef | null | undefined, inGameView: boolean) {
  const activeTheme = inGameView && game?.gameTheme ? GAME_THEMES[game.gameTheme] : null;

  /**
   * El fondo de `S.app` solo pinta el div raíz propio de la app — en mobile,
   * el overscroll/rubber-banding (arrastrar más allá del borde superior/
   * inferior de la página) muestra lo que hay detrás de ese div: el fondo
   * propio del `<body>` (seteado una sola vez, de forma estática, en
   * `index.html`) y el meta tag `theme-color` del navegador. Ninguno de los
   * dos seguía antes el fondo de un juego con tema propio, así que arrastrar
   * hacia abajo en medio de Recámara mostraba un flash del morado oscuro por
   * defecto de la app en vez de su propio negro casi puro. Se mantiene
   * sincronizado acá en vez de en `index.html` porque el tema solo se conoce
   * en tiempo de ejecución, y se resetea al desmontar para que salir del
   * juego con tema propio no deje el tinte puesto para la próxima pantalla.
   */
  useEffect(() => {
    const bg = (activeTheme?.app.background as string | undefined) ?? "#0f0c1d";
    document.body.style.background = bg;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
    return () => {
      document.body.style.background = "#0f0c1d";
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#0f0c1d");
    };
  }, [activeTheme]);

  const accentColor = activeTheme?.accent ?? "#7F77DD";
  const mutedColor = activeTheme?.muted ?? "#6b6490";

  /**
   * Todo componente compartido de "unirse a una sala" (`CodeDisplay`,
   * `QRDialog`) lee estas variables CSS en vez de hardcodear el morado/verde
   * por defecto — ver `theme/sharedChrome.css`. Solo se setean cuando hay un
   * tema realmente activo; si no, las variables se quedan con los valores
   * por defecto de `:root` propios de `sharedChrome.css` (el look normal de
   * esta app, sin tocar, para todo juego sin tema propio).
   */
  const chromeVars: CSSProperties = activeTheme
    ? ({
        "--jt-accent": accentColor,
        "--jt-accent-strong": activeTheme.accentStrong ?? accentColor,
        "--jt-surface": activeTheme.surface ?? (activeTheme.app.background as string | undefined),
        "--jt-muted": mutedColor,
        // El CTA estilo "Iniciar ronda" también combina con el acento de
        // este tema, en vez de quedarse con el verde de toda la app.
        "--jt-cta-from": accentColor,
        "--jt-cta-to": `color-mix(in srgb, ${accentColor} 70%, black)`,
        "--jt-cta-shadow": `color-mix(in srgb, ${accentColor} 35%, transparent)`,
        // La franja de fade-to-bg de StickyActionBar (detrás de ese mismo CTA).
        "--jt-bg": activeTheme.app.background as string | undefined,
        // El look compartido de card/label/texto muted (S.card/S.label/
        // S.muted en theme/styles.ts) — cubre gratis la card de la lista de
        // jugadores del lobby online, sin cambios por pantalla.
        "--jt-card-bg": "color-mix(in srgb, black 25%, transparent)",
        "--jt-card-border": `color-mix(in srgb, ${accentColor} 30%, transparent)`,
        "--jt-row-border": `color-mix(in srgb, ${accentColor} 15%, transparent)`,
        "--jt-label": accentColor,
        "--jt-muted-text": mutedColor,
      } as CSSProperties)
    : {};

  return { activeTheme, accentColor, mutedColor, chromeVars };
}
