import type { ReactNode } from "react";

// Wraps a phase's whole screen so switching between them reads as a
// transition instead of an instant content swap. `phaseKey` should be
// something that changes once per phase (the phase name itself is enough) —
// keying the wrapper off it forces a remount, which is what replays the
// animation. Shared across every game's RoundView/LocalGame — originally
// lived only in rayado-libre, moved here so the same fade-in covers every
// phase change instead of just that one game's.
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
