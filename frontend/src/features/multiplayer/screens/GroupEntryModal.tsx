import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "../../../components/ui/icons";

const SCRIM =
  "fixed inset-0 z-40 flex items-center justify-center p-5 bg-[color-mix(in_srgb,var(--jt-bg)_72%,transparent)] backdrop-blur-[18px] animate-[jt-modal-scrim-in_100ms_ease-out] motion-reduce:animate-none";

const GLOW = "absolute rounded-full pointer-events-none blur-[90px]";

const CARD =
  "relative w-full max-w-[420px] max-h-[calc(100vh-40px)] overflow-y-auto rounded-[28px] border border-jt-card-border bg-jt-card-bg shadow-[0_24px_70px_-20px_rgba(0,0,0,0.7)] p-[22px] min-[640px]:max-w-[480px] min-[640px]:p-7";

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
    <div className={SCRIM} onClick={onClose}>
      <div
        aria-hidden
        className={`${GLOW} left-[8%] top-[12%] w-[32vw] h-[32vw] max-w-[380px] max-h-[380px] min-w-[200px] min-h-[200px] bg-[color-mix(in_srgb,var(--jt-accent)_26%,transparent)]`}
      />
      <div
        aria-hidden
        className={`${GLOW} right-[10%] bottom-[10%] w-[28vw] h-[28vw] max-w-[320px] max-h-[320px] min-w-[180px] min-h-[180px] bg-[color-mix(in_srgb,#1d9e75_22%,transparent)]`}
      />
      <div className={`${CARD} jt-animate-rise`} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Cancelar" className="absolute top-3.5 right-3.5 jt-close-chip jt-close-chip--circle">
          <CloseIcon size={14} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
