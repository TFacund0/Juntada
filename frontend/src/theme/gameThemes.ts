import type { CSSProperties } from "react";

// Full-app reskins for games whose visual identity is distinct enough that
// the shared default look (S.app/S.title/etc in styles.ts) would clash with
// it. A game opts in by setting `gameTheme: "<key>"` on its GameDef (see
// games/gameTypes.ts) — App.tsx then merges `app` over S.app, swaps the
// header's accent/muted text colors, sets the --jt-* CSS vars every shared
// "join a room" component reads (CodeDisplay, QRDialog — see
// theme/sharedChrome.css), and (optionally) paints a faint full-screen
// watermark behind everything, for as long as that game's LocalGame/
// RoundView is on screen. It also plays a fade-to-black transition on the
// way in and out so the swap never reads as a hard cut. Add one entry per
// themed game; every game without an entry here keeps the default look.
//
// Only `app`/`accent`/`muted` are required — a new theme doesn't need to
// hunt down every shared component's hardcoded color to look right in all
// of them: `accentStrong`/`surface` fall back to `accent`/`app.background`,
// and everything else those components need (soft tints, borders) derives
// from those three via color-mix() in sharedChrome.css, not per-theme here.
export interface GameTheme {
  // Merged over S.app: background/text color/font of the shared chrome.
  app: CSSProperties;
  // Replaces the purple (#7F77DD) used for headings/labels/links in the
  // shared header (App.tsx) and for --jt-accent everywhere else.
  accent: string;
  // Replaces the grey (#6b6490) used for secondary/muted header text, and
  // for --jt-muted everywhere else.
  muted: string;
  // A brighter/lighter variant of `accent` for things that sit on top of
  // `accent`-colored surfaces (e.g. the big room code itself). Defaults to
  // `accent` when omitted.
  accentStrong?: string;
  // Card/dialog background for shared overlays (QRDialog, etc). Defaults to
  // `app.background` when omitted.
  surface?: string;
  // Single emoji rendered huge and faint, fixed behind everything — a cheap
  // "watermark" that doesn't require sourcing/shipping an image asset.
  backdropEmoji?: string;
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
    backdropEmoji: "💀",
  },
};
