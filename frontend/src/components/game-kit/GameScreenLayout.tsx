import type { CSSProperties, ReactNode } from "react";
import { StickyActionBar, STICKY_ACTION_BAR_CLEARANCE } from "../setup/StickyActionBar";

/**
 * Las 3 zonas que se repiten en toda pantalla jugable: `top` para el
 * contexto/estado (timer, turno, pista — chico, no interactivo), `center`
 * para lo protagonista de ese momento (canvas, cartas, tabla de puntos —
 * ocupa el espacio sobrante), y `bottom` para acciones secundarias
 * (herramientas, chat, botones). Puramente de layout — la animación de
 * cambio de fase la sigue poniendo `PhaseTransition` por fuera.
 */
export function GameScreenLayout({
  top,
  center,
  bottom,
  stickyBottom,
  className,
  style,
}: {
  top?: ReactNode;
  center: ReactNode;
  bottom?: ReactNode;
  /**
   * Acción principal fijada abajo del viewport (ver `StickyActionBar`) en vez
   * de al final del flujo normal — agrega automáticamente el padding inferior
   * que necesita (`STICKY_ACTION_BAR_CLEARANCE`) para que no tape la última
   * card de `center`/`bottom`. Antes cada pantalla con acción fija repetía a
   * mano el wrapper `paddingBottom` + `<StickyActionBar>` alrededor suyo.
   */
  stickyBottom?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <>
      <div
        className={className}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          ...(stickyBottom ? { paddingBottom: STICKY_ACTION_BAR_CLEARANCE } : null),
          ...style,
        }}
      >
        {top && <div style={{ flex: "0 0 auto" }}>{top}</div>}
        <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", minHeight: 0, gap: 12 }}>{center}</div>
        {bottom && <div style={{ flex: "0 0 auto" }}>{bottom}</div>}
      </div>
      {stickyBottom && <StickyActionBar>{stickyBottom}</StickyActionBar>}
    </>
  );
}
