import type { CSSProperties } from "react";

/**
 * Reskins de toda la app para juegos cuya identidad visual es lo bastante
 * distinta como para que el look compartido por defecto (`S.app`/`S.title`/
 * etc. en `styles.ts`) desentone. Un juego se suma seteando
 * `gameTheme: "<clave>"` en su `GameDef` (ver `games/gameTypes.ts`) —
 * `App.tsx` entonces mezcla `app` sobre `S.app`, cambia los colores de
 * acento/muted del header, setea las variables CSS `--jt-*` que lee todo
 * componente compartido de "unirse a una sala" (`CodeDisplay`, `QRDialog` —
 * ver `theme/sharedChrome.css`), y (opcionalmente) pinta una marca de agua
 * tenue de pantalla completa detrás de todo, mientras el `LocalGame`/
 * `RoundView` de ese juego esté en pantalla. También reproduce una transición
 * de fundido a negro al entrar y salir para que el cambio nunca se sienta
 * como un corte brusco. Agregá una entrada por cada juego con tema propio;
 * todo juego sin entrada acá se queda con el look por defecto.
 *
 * Solo `app`/`accent`/`muted` son obligatorios — un tema nuevo no necesita
 * salir a cazar el color hardcodeado de cada componente compartido para que
 * se vea bien en todos: `accentStrong`/`surface` caen por defecto en
 * `accent`/`app.background`, y todo lo demás que esos componentes necesitan
 * (tintes suaves, bordes) deriva de esos tres vía `color-mix()` en
 * `sharedChrome.css`, no acá, tema por tema.
 */
export interface GameTheme {
  /** Mezclado sobre `S.app`: fondo/color de texto/fuente del chrome compartido. */
  app: CSSProperties;
  /**
   * Reemplaza el morado (`#7F77DD`) usado para títulos/labels/links en el
   * header compartido (`App.tsx`) y para `--jt-accent` en todo el resto.
   */
  accent: string;
  /**
   * Reemplaza el gris (`#6b6490`) usado para el texto secundario/muted del
   * header, y para `--jt-muted` en todo el resto.
   */
  muted: string;
  /**
   * Una variante más clara/brillante de `accent` para elementos que se
   * apoyan sobre superficies con color `accent` (ej. el código de sala
   * grande en sí). Por defecto toma el valor de `accent` si se omite.
   */
  accentStrong?: string;
  /**
   * Fondo de card/diálogo para los overlays compartidos (`QRDialog`, etc).
   * Por defecto toma el valor de `app.background` si se omite.
   */
  surface?: string;
  /**
   * Un único emoji renderizado enorme y tenue, fijo detrás de todo — una
   * "marca de agua" barata que no requiere conseguir/empaquetar una imagen.
   */
  backdropEmoji?: string;
  /**
   * La misma idea que `backdropEmoji`, pero con una imagen real (ej. el
   * logo propio del juego) en vez de un glifo de emoji — tiene prioridad
   * sobre `backdropEmoji` cuando ambos están seteados. Funciona mejor con
   * arte que ya sea oscuro/casi transparente (un fondo negro se funde con
   * el fondo propio de la app en baja opacidad), ya que se renderiza tenue
   * y sin aplicarle ningún tinte.
   */
  backdropImage?: string;
}

export const GAME_THEMES: Record<string, GameTheme> = {
  recamara: {
    app: {
      background: "#171310",
      color: "#ece4d6",
      fontFamily: "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif",
    },
    accent: "#b3261e",
    accentStrong: "#ff4d3d",
    surface: "#211b16",
    muted: "#9a9082",
  },
  // Tomado del propio logo/arte de fondo del juego (una máscara blanca vs.
  // una máscara negra con un ojo rojo, sobre negro, con un anillo rojo).
  impostor: {
    app: {
      background: "#0a0a0a",
      color: "#f2f0ea",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    accent: "#e0202b",
    accentStrong: "#ff3b3b",
    surface: "#161616",
    muted: "#a8a29e",
  },
  // Tomado del anillo arcoíris del logo (rojo→naranja→verde→azul→violeta)
  // sobre un trazo de tinta navy. El fondo del chrome se mantiene oscuro (en
  // vez del papel claro del logo) para no pelear contra los componentes
  // compartidos que asumen texto claro sobre fondo oscuro — el look "papel"
  // se reserva a las cards propias del juego.
  "rayado-libre": {
    app: {
      background: "#171522",
      color: "#f2eee2",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    accent: "#2e8bff",
    accentStrong: "#a855f7",
    surface: "#1d1a2e",
    muted: "#8c87ac",
  },
  // Tomado del propio logo: degradé azul→violeta→magenta del globo de
  // diálogo con la "T", sobre un fondo casi negro azulado.
  tutifruti: {
    app: {
      background: "#0d0c1c",
      color: "#eeeaf9",
      fontFamily: "'Syne', sans-serif",
    },
    accent: "#5b5ce0",
    accentStrong: "#c94bd6",
    surface: "#161329",
    muted: "#8c86b8",
  },
};
