import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Una única acción principal (arrancar la ronda/partida) fijada abajo de la
 * pantalla con un degradé para que nunca se pierda debajo de un lobby/
 * config largo con scroll — mismo tratamiento en el lobby online
 * (`MultiplayerGame.tsx`) y en el setup local pasa-y-juega (`LocalGame.tsx`).
 * El contenido de la página necesita su propio padding inferior (~88px)
 * para que esto no tape la última card.
 *
 * Portal a document.body: esto cuelga del <ScreenFade> de App.tsx, que
 * anima con `transform` durante 0.32s al montar la pantalla — un `transform`
 * en un ancestro atrapa cualquier `position: fixed` de acá adentro, pegando
 * esta barra al wrapper animado (mal ubicada) en vez de al viewport durante
 * ese instante. Mismo motivo que RoomEntryModal/GroupEntryModal.
 */
export function StickyActionBar({ children }: { children: ReactNode }) {
  return createPortal(
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
        // Lee --jt-bg (theme/sharedChrome.css) en vez de hardcodear
        // #0f0c1d, así esto se funde con el fondo real de un juego con
        // tema propio en vez de fundirse siempre con el que no tiene tema.
        background: "linear-gradient(transparent, var(--jt-bg, #0f0c1d) 24%)",
        zIndex: 10,
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>{children}</div>
    </div>,
    document.body,
  );
}
