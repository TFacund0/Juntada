import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import "./GroupEntryModal.css";

/**
 * Chrome del modal de "Crear grupo"/"Unirme" — scrim + blobs difuminados
 * (mismo lenguaje visual que el Hero del home, ver components/Hero.tsx) en
 * vez del fondo plano de DialogFrame, para que se sienta continuación de la
 * homepage en vez de una pantalla de sistema aparte. No usa DialogFrame:
 * necesita su propio ancho/tabs, que ese componente no contempla.
 *
 * Portal a document.body: este componente vive dentro de MultiplayerGame,
 * que a su vez cuelga del <ScreenFade> de App.tsx — ese wrapper anima con
 * `transform`, y un ancestro con transform pasa a ser el "containing block"
 * de cualquier descendiente `position: fixed`, así que sin portal el modal
 * quedaba atrapado adentro de esa cajita (pegado bajo el navbar) en vez de
 * centrarse en toda la ventana de verdad.
 */
export function GroupEntryModal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return createPortal(
    <div className="jt-group-modal-scrim" onClick={onClose}>
      <div aria-hidden className="jt-group-modal-glow jt-group-modal-glow--a" />
      <div aria-hidden className="jt-group-modal-glow jt-group-modal-glow--b" />
      <div className="jt-group-modal-card jt-animate-rise" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Cancelar" className="jt-group-modal-close">
          {/* SVG (no el glifo de texto "✕") — un glifo trae su propio
              ascenso/descenso tipográfico y queda descentrado dentro del
              círculo aunque el botón esté centrado por flexbox; ver el mismo
              criterio en AppHeader.tsx. */}
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            style={{ display: "block" }}
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
