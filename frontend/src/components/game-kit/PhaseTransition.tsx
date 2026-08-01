import type { ReactNode } from "react";

/**
 * Envuelve la pantalla entera de una fase para que cambiar entre fases se
 * sienta como una transición en vez de un cambio instantáneo de contenido.
 * `phaseKey` debería ser algo que cambia una vez por fase (el propio nombre
 * de la fase alcanza) — usarlo como `key` del wrapper fuerza un remount, que
 * es lo que hace que la animación se repita. Compartido entre el
 * `RoundView`/`LocalGame` de todos los juegos — originalmente vivía solo en
 * rayado-libre, se movió acá para que el mismo fade-in cubra todo cambio de
 * fase en vez de solo el de ese juego.
 */
export function PhaseTransition({ phaseKey, children }: { phaseKey: string; children: ReactNode }) {
  return (
    <div key={phaseKey} style={{ animation: "phase-in 0.25s ease-out" }}>
      <style>{`
        @keyframes phase-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {children}
    </div>
  );
}
