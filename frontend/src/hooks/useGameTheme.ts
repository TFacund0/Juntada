import { useEffect } from "react";
import { GAME_THEMES, type GameTheme } from "../theme/gameThemes";
import type { GameDef } from "../games/gameTypes";

/**
 * Deriva las variables CSS `--jt-*` (ver `theme/sharedChrome.css`) a partir
 * de las tres obligatorias de un `GameTheme` (`app`/`accent`/`muted`) — así
 * sumar un juego con tema propio nuevo solo implica agregar su entrada en
 * `GAME_THEMES` con esos valores (y opcionalmente `accentStrong`/`surface`);
 * ningún componente compartido nuevo necesita tocarse para heredar el color.
 */
function chromeVarsFor(theme: GameTheme): Record<string, string> {
  const accent = theme.accent;
  return {
    "--jt-accent": accent,
    "--jt-accent-strong": theme.accentStrong ?? accent,
    "--jt-surface": theme.surface ?? (theme.app.background as string),
    "--jt-muted": theme.muted,
    // El CTA estilo "Iniciar ronda" combina con el acento de este tema, en
    // vez de quedarse con el verde de toda la app.
    "--jt-cta-from": accent,
    "--jt-cta-to": `color-mix(in srgb, ${accent} 70%, black)`,
    "--jt-cta-shadow": `color-mix(in srgb, ${accent} 35%, transparent)`,
    // La franja de fade-to-bg de StickyActionBar (detrás de ese mismo CTA).
    "--jt-bg": theme.app.background as string,
    // El look compartido de card/label/texto muted (S.card/S.label/
    // S.muted en theme/styles.ts) — cubre gratis la card de la lista de
    // jugadores del lobby online, sin cambios por pantalla.
    "--jt-card-bg": "color-mix(in srgb, black 25%, transparent)",
    "--jt-card-border": `color-mix(in srgb, ${accent} 30%, transparent)`,
    "--jt-row-border": `color-mix(in srgb, ${accent} 15%, transparent)`,
    "--jt-label": accent,
    "--jt-muted-text": theme.muted,
  };
}

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

  /**
   * Las variables `--jt-*` (ver `theme/sharedChrome.css`) se setean en
   * `<html>` (documentElement), no en el div raíz de `App.tsx`: varios de
   * los componentes compartidos que las leen (`StickyActionBar`, la barra
   * de "Iniciar ronda" del lobby, `Toast`, los modales de sala/grupo) se
   * portan a `document.body` para escapar del wrapper animado de
   * `<ScreenFade>` (ver esos componentes), quedando así fuera del subárbol
   * de ese div — pero siempre dentro del de `<html>`. Solo se setean
   * cuando hay un tema realmente activo; al desmontar/cambiar se limpian y
   * las variables vuelven a los valores por defecto de `:root` en
   * `sharedChrome.css` (el look normal de la app, para todo juego sin tema
   * propio).
   */
  useEffect(() => {
    if (!activeTheme) return;
    const root = document.documentElement.style;
    const vars = chromeVarsFor(activeTheme);
    for (const [key, value] of Object.entries(vars)) root.setProperty(key, value);
    return () => {
      for (const key of Object.keys(vars)) root.removeProperty(key);
    };
  }, [activeTheme]);

  const accentColor = activeTheme?.accent ?? "#7F77DD";
  const mutedColor = activeTheme?.muted ?? "#6b6490";

  return { activeTheme, accentColor, mutedColor };
}
