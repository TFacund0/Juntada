import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "../../../components/ui/icons";

const SCRIM =
  "fixed inset-0 z-40 flex items-center justify-center p-5 bg-[color-mix(in_srgb,var(--jt-bg)_74%,transparent)] backdrop-blur-[18px] animate-[jt-modal-scrim-in_100ms_ease-out] motion-reduce:animate-none";

// Haz diagonal difuminado que cruza el scrim — un solo elemento en vez de
// los dos blobs redondos del modal de grupo, para que el fondo detrás de la
// card se lea distinto a simple vista.
const BEAM =
  "absolute -inset-[20%] pointer-events-none blur-[50px] bg-[linear-gradient(115deg,transparent_30%,color-mix(in_srgb,var(--jt-accent)_20%,transparent)_48%,color-mix(in_srgb,var(--jt-accent)_20%,transparent)_54%,transparent_72%)]";

const CARD =
  "relative w-full max-w-[420px] max-h-[calc(100vh-40px)] overflow-y-auto [overflow-x:visible] rounded-[18px] border border-jt-card-border bg-jt-card-bg shadow-[0_24px_70px_-20px_rgba(0,0,0,0.7)] pt-[26px] px-[22px] pb-[22px] min-[640px]:max-w-[480px] min-[640px]:pt-[30px] min-[640px]:px-7 min-[640px]:pb-[26px]";

/**
 * Chrome del modal de "Crear sala"/"Unirse" para un juego ya elegido —
 * mismo criterio estructural que GroupEntryModal (portal + scrim + card
 * centrada) pero con su propio motivo visual (un haz diagonal en vez de dos
 * blobs, esquinas más cuadradas, botón de cerrar cuadrado) para que esta
 * pantalla no se sienta un calco de "Crear grupo". Portal a document.body
 * por el mismo motivo que GroupEntryModal: este componente cuelga del
 * <ScreenFade> de App.tsx, que anima con `transform`, y eso atraparía
 * cualquier `position: fixed` de acá adentro sin el portal.
 */
export function RoomEntryModal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return createPortal(
    <div className={SCRIM} onClick={onClose}>
      <div aria-hidden className={BEAM} />
      <div className={`${CARD} jt-animate-rise`} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Cancelar" className="absolute top-3.5 right-3.5 jt-close-chip">
          <CloseIcon size={14} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
