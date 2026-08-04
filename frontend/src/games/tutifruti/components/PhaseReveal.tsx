import type { ReactNode } from "react";

const DIRECTION_CLASS = {
  zoom: "tf-phase-zoom",
  right: "tf-phase-slide-right",
  up: "tf-phase-slide-up",
} as const;

/**
 * Variante de PhaseTransition (components/game-kit) propia de Tutifruti:
 * en vez de un único fade+translateY igual para toda fase, cada una entra
 * con una dirección propia (setup hace zoom desde el centro, writing entra
 * desde la derecha, review desde abajo) — vive acá y no en game-kit porque
 * es una decisión de diseño específica de este juego, no algo pensado para
 * que otros juegos reutilicen. Mismo mecanismo de fondo que
 * PhaseTransition: `phaseKey` como `key` fuerza el remount que dispara la
 * animación CSS (ver tf-phase-* en css/tutifruti.css).
 */
export function PhaseReveal({
  phaseKey,
  direction,
  children,
}: {
  phaseKey: string;
  direction: keyof typeof DIRECTION_CLASS;
  children: ReactNode;
}) {
  return (
    <div key={phaseKey} className={DIRECTION_CLASS[direction]}>
      {children}
    </div>
  );
}
