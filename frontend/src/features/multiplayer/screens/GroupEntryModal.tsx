import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "../../../components/ui/icons";
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
        <button onClick={onClose} aria-label="Cancelar" className="jt-group-modal-close jt-close-chip jt-close-chip--circle">
          <CloseIcon size={14} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
