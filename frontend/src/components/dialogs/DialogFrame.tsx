import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./DialogFrame.css";
import { DEFAULT_COLORS } from "../../theme/styles/colors";

// `<video>`/`<canvas>` quedan deliberadamente afuera: ninguno es focusable
// sin `controls`/`tabindex`, y el video de QRScannerDialog no tiene ninguno
// de los dos — así el foco inicial cae solo en controles reales (ej. el
// botón "Cancelar"), sin necesidad de un caso especial por consumidor.
const FOCUSABLE =
  "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled])," +
  'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface DialogFrameProps {
  onClose: () => void;
  /** `alertdialog` solo para diálogos que exigen una decisión (ConfirmDialog). */
  role?: "dialog" | "alertdialog";
  /** id del nodo de título dentro de `children`; conecta `aria-labelledby`. */
  titleId?: string;
  /** Escape cierra el diálogo. Independiente de `closeOnOverlayClick`. */
  closeOnEscape?: boolean;
  maxWidth?: number;
  padding?: CSSProperties["padding"];
  overlayOpacity?: number;
  /**
   * Desenfoca lo que queda detrás del overlay (ej. NewGameDialog en mobile,
   * donde el menú del grupo debe seguir viéndose de fondo pero borroso) en
   * vez del oscurecido liso por defecto.
   */
  overlayBlur?: number;
  textAlign?: CSSProperties["textAlign"];
  /**
   * Overrides puntuales para la card interna — ej. el `overflow: hidden` +
   * `position: relative` de `GameDetailDialog` para su propio botón de
   * cerrar, o las variables con tema `--jt-surface`/`--jt-accent-border` de
   * `QRDialog` en vez del look por defecto hardcodeado.
   */
  cardStyle?: CSSProperties;
  /**
   * `false` para un aviso único (`WelcomeDialog`) que debe cerrarse
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
  role = "dialog",
  titleId,
  closeOnEscape = true,
  maxWidth = 360,
  padding = "24px 20px",
  overlayOpacity = 0.75,
  overlayBlur,
  textAlign,
  cardStyle,
  cardClassName,
  closeOnOverlayClick = true,
  children,
}: DialogFrameProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Captura de foco + foco inicial: deps `[]` a propósito — separado del
  // efecto de teclado de abajo para que un `onClose` inline (arrow function
  // nueva en cada render del padre) no vuelva a robar el foco en cada
  // re-render.
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const prev = document.activeElement as HTMLElement | null;
    const focusables = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null);
    (focusables[0] ?? card).focus();
    return () => {
      if (prev && document.contains(prev)) prev.focus();
    };
  }, []);

  // Listener de teclado en `document`: deps `[]`, lee `onClose`/`closeOnEscape`
  // vía refs para no reinstalarse (y por lo tanto no re-ejecutar la captura de
  // foco de arriba) en cada render del padre.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeOnEscapeRef = useRef(closeOnEscape);
  closeOnEscapeRef.current = closeOnEscape;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const card = cardRef.current;
      if (!card) return;
      if (e.key === "Escape") {
        if (closeOnEscapeRef.current) {
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (e.key !== "Tab") return;
      const list = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null);
      if (list.length === 0) {
        e.preventDefault();
        card.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === card)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!card.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return createPortal(
    <div
      className="jt-dialog-overlay"
      onClick={closeOnOverlayClick ? onClose : undefined}
      style={{
        position: "fixed",
        inset: 0,
        background: `rgba(15,12,29,${overlayOpacity})`,
        backdropFilter: overlayBlur ? `blur(${overlayBlur}px)` : undefined,
        WebkitBackdropFilter: overlayBlur ? `blur(${overlayBlur}px)` : undefined,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: "var(--jt-z-dialog, 1000)",
      }}
    >
      <div
        ref={cardRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cardClassName ? `jt-dialog-card ${cardClassName}` : "jt-dialog-card"}
        onClick={e => e.stopPropagation()}
        style={{
          background: `var(--jt-surface, ${DEFAULT_COLORS.surface})`,
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
