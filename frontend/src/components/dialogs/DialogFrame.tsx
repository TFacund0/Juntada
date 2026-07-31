import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import "./DialogFrame.css";

interface DialogFrameProps {
  onClose: () => void;
  maxWidth?: number;
  padding?: CSSProperties["padding"];
  overlayOpacity?: number;
  textAlign?: CSSProperties["textAlign"];
  /**
   * Overrides puntuales para la card interna — ej. el `overflow: hidden` +
   * `position: relative` de `GameDetailDialog` para su propio botón de
   * cerrar, o las variables con tema `--jt-surface`/`--jt-accent-border` de
   * `QRDialog` en vez del look por defecto hardcodeado.
   */
  cardStyle?: CSSProperties;
  /**
   * `false` para un aviso único (`DevNoticeDialog`) que debe cerrarse
   * explícitamente con su propio botón — tocar el fondo no debería
   * saltearlo en silencio.
   */
  closeOnOverlayClick?: boolean;
  /**
   * Clase extra para la card — permite que un diálogo puntual (ej.
   * `GameDetailDialog`) crezca en pantallas grandes vía @media en su propio
   * CSS, algo que `maxWidth` (un número fijo, sin puntos de quiebre) no
   * puede hacer solo.
   */
  cardClassName?: string;
  children: ReactNode;
}

/**
 * Marco compartido de overlay fijo + card centrada detrás de todo diálogo
 * modal (`ConfirmDialog`, `GameDetailDialog`, `QRScannerDialog`, `QRDialog`,
 * ...) — tocar el overlay en sí cierra el diálogo; tocar la card no (por el
 * `stopPropagation`), así un toque adentro nunca burbujea como un cierre
 * accidental.
 *
 * Portal a document.body: estos diálogos suelen vivir dentro del
 * `<ScreenFade>` de una pantalla (theme/screenTransitions.css), que anima
 * con `transform` — un ancestro con `transform` pasa a ser el "containing
 * block" de cualquier descendiente `position: fixed`, así que sin portal el
 * overlay quedaba atado a la posición de ese contenedor (a veces fuera de la
 * ventana visible) en vez de cubrir y centrarse en toda la ventana de
 * verdad. Mismo criterio que GroupEntryModal.tsx.
 */
export function DialogFrame({
  onClose,
  maxWidth = 360,
  padding = "24px 20px",
  overlayOpacity = 0.75,
  textAlign,
  cardStyle,
  cardClassName,
  closeOnOverlayClick = true,
  children,
}: DialogFrameProps) {
  return createPortal(
    <div
      className="jt-dialog-overlay"
      onClick={closeOnOverlayClick ? onClose : undefined}
      style={{
        position: "fixed",
        inset: 0,
        background: `rgba(15,12,29,${overlayOpacity})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 1000,
      }}
    >
      <div
        className={cardClassName ? `jt-dialog-card ${cardClassName}` : "jt-dialog-card"}
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--jt-surface, #171329)",
          border: "1px solid var(--jt-accent-border, rgba(127,119,221,0.3))",
          borderRadius: 16,
          padding,
          maxWidth,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          textAlign,
          ...cardStyle,
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
