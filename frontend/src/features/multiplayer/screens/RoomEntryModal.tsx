import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "../../../components/ui/icons";
import "./RoomEntryModal.css";

/**
 * Chrome del modal de "Crear sala"/"Unirse" para un juego ya elegido —
 * mismo criterio estructural que GroupEntryModal (portal + scrim + card
 * centrada) pero con su propio motivo visual (ver RoomEntryModal.css) para
 * que esta pantalla no se sienta un calco de "Crear grupo". Portal a
 * document.body por el mismo motivo que GroupEntryModal: este componente
 * cuelga del <ScreenFade> de App.tsx, que anima con `transform`, y eso
 * atraparía cualquier `position: fixed` de acá adentro sin el portal.
 */
export function RoomEntryModal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return createPortal(
    <div className="jt-room-modal-scrim" onClick={onClose}>
      <div aria-hidden className="jt-room-modal-beam" />
      <div className="jt-room-modal-card jt-animate-rise" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Cancelar" className="jt-room-modal-close jt-close-chip">
          <CloseIcon size={14} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
