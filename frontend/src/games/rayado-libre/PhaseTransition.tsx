import type { ReactNode } from "react";

// Wraps a phase's whole screen (choosing/drawing/reveal/result, in both
// LocalGame and RoundView) so switching between them reads as a transition
// instead of an instant content swap. `phaseKey` should be something that
// changes once per phase (the phase name itself is enough) — keying the
// wrapper off it forces a remount, which is what replays the animation.
export function PhaseTransition({ phaseKey, children }: { phaseKey: string; children: ReactNode }) {
  return (
    <div key={phaseKey} style={{ animation: "rl-phase-in 0.25s ease-out" }}>
      <style>{`
        @keyframes rl-phase-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {children}
    </div>
  );
}
