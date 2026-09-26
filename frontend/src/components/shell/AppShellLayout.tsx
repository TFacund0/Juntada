import type { ReactNode } from "react";
import clsx from "clsx";
import type { GameDef } from "../../games/gameTypes";
import { HeroBackdrop } from "./Hero";
import { ModePickerBackdrop } from "./ModePicker";

interface AppShellLayoutProps {
  stepKey: string;
  game: GameDef | null | undefined;
  inGameView: boolean;
  header: ReactNode;
  rest: ReactNode;
}

/**
 * Los tres layouts de nivel-app, extraídos tal cual de la IIFE que vivía
 * inline en App.tsx (junto con la IIFE anidada de "wide", ahora aplanada acá
 * abajo en un simple `const wide`). Puramente presentacional: decide qué
 * wrapper/fondo va alrededor de `header`/`rest` según el paso actual
 * (`stepKey`), sin conocer nada de la lógica que arma esos dos nodos — ver
 * App.tsx por cómo se componen.
 */
export function AppShellLayout({ stepKey, game, inGameView, header, rest }: AppShellLayoutProps) {
  // Paso "picker" (home): el navbar necesita fondo a todo lo ancho de
  // la ventana (como una landing real), no acotado a los 480px fijos
  // que sí llevan las pantallas de juego — por eso acá el navbar vive
  // en un contenedor sin maxWidth, y solo su contenido interno (y el
  // resto de la pantalla) usan jt-home-wrap para centrarse con el
  // ancho creciente por breakpoint (theme/homeDesign.css).
  if (stepKey === "picker") {
    return (
      <div className="relative z-[1]">
        {/* Hermano de <ScreenFade> (dentro de `rest`), no descendiente
            suyo — ver el comentario en HeroBackdrop (Hero.tsx) sobre
            por qué un fondo `position: fixed` no puede vivir adentro
            del wrapper que ScreenFade anima con `transform`. */}
        <HeroBackdrop />
        {/* El navbar (fondo sticky) va suelto, sin jt-home-wrap acá —
            es él mismo quien centra su contenido interno con esa clase
            (ver AppHeader), así su fondo llega a los bordes reales de
            la ventana en vez de cortarse en el ancho del contenido. */}
        {header}
        {/* paddingTop compensa que el navbar ahora es fixed (ver
            AppHeader) y ya no ocupa espacio en el flujo normal — sin
            esto, Hero/GamePicker quedarían tapados debajo suyo. 72px
            alcanza para cubrir su altura real tanto en mobile (~57px,
            logo achicado bajo 420px) como en desktop (~65px) con un
            margen chico; el aire de sobra ya lo da el padding propio
            de Hero (jt-hero-section, 40-56px) — no hace falta sumar
            más acá o el espacio se duplica. */}
        <div className="jt-home-wrap mx-auto px-4 pb-[60px] pt-[72px]">{rest}</div>
      </div>
    );
  }

  // Paso "elegí cómo jugar": a diferencia de las pantallas de juego en
  // sí (formularios/lobby, pensados mobile-first a 480px fijos), acá no
  // hay nada que se vuelva incómodo si crece — así que en vez de dejar
  // 3 filas angostas nadando en espacio vacío en desktop, este paso usa
  // un contenedor propio que crece por breakpoint (jt-mode-wrap,
  // theme/modeRow.css) para que ModePicker pueda acomodar sus opciones
  // en grilla en pantallas grandes.
  if (stepKey.startsWith("modepicker-")) {
    return (
      <div className="jt-mode-wrap jt-content-pad-top relative z-[1] mx-auto">
        {/* Hermano de <ScreenFade> (dentro de `rest`), no descendiente
            suyo — mismo motivo que HeroBackdrop arriba. */}
        <ModePickerBackdrop />
        {header}
        {rest}
      </div>
    );
  }

  // jt-content-pad-top compensa que el navbar de estas pantallas
  // también pasó a ser fixed (ver AppHeader) y ya no ocupa espacio en
  // el flujo normal — vive en una clase (theme/sharedChrome.css) y no
  // en `style` porque necesita crecer desde los 900px (el navbar
  // in-game crece ahí también), algo que un padding puesto por
  // `style` inline no puede hacer. `jt-round-wrap-wide` reemplaza el
  // `maxWidth: 480` fijo de S.wrap solo mientras el RoundView de un
  // juego con `wideRoundView` (GameDef) está en pantalla — el lobby/
  // ConfigPanel de ese mismo juego se queda a 480px como cualquier
  // otro, ya que no está pensado para ese ancho. `"full"` (rayado-libre)
  // usa `jt-round-wrap-full`: hasta 1440px a cualquier ancho de pantalla.
  const wide = inGameView ? game?.wideRoundView : undefined;
  return (
    <div
      className={clsx(
        "jt-content-pad-top relative z-[1] mx-auto px-4 pb-[60px]",
        wide === "full" ? "jt-round-wrap-full" : wide ? "jt-round-wrap-wide" : "max-w-[480px]",
      )}
    >
      {header}
      {rest}
    </div>
  );
}
