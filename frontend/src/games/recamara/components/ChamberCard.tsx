import type { ReactNode } from "react";
import { Timer } from "../../../components/game-kit/Timer";
import type { RecamaraSfx } from "../hooks/recamaraSfx";
import { Shotgun } from "./Shotgun";
import { ReloadSequence } from "./ReloadSequence";

// Beat 3 of "reveal" — the chamber card (gun + the chamber being loaded,
// real/falso shells shown and then shuffled face-down, see ReloadSequence), held up for a
// visible countdown before the duel actually starts. Shared verbatim by
// LocalGame and RoundView; only the button in `controls` differs (local
// starts the duel client-side, online sends `ready_for_duel`).
export function ChamberCard({
  liveCount,
  blankCount,
  sfx,
  introEndsAt,
  introMs,
  controls,
  overlay,
  showLegend = false,
}: {
  liveCount: number;
  blankCount: number;
  sfx?: RecamaraSfx;
  introEndsAt: number;
  introMs: number;
  controls: ReactNode;
  overlay?: ReactNode;
  // Only round 1 spells out what 🔴/🟡 mean — from round 2 on, the table
  // already knows.
  showLegend?: boolean;
}) {
  return (
    <div className="recamara">
      <div className="rec-table round-chamber">
        <div className="chamber-focus">
          <div className="mx-auto mb-2.5 w-40">
            <Shotgun />
          </div>
          <ReloadSequence liveCount={liveCount} blankCount={blankCount} sfx={sfx} />
          {showLegend && <p className="bullet-legend mono">🔴 real · 🟡 falsa</p>}
          <p className="shell-count mono">{liveCount + blankCount} cartuchos en la recámara — el orden es secreto</p>
        </div>
        {introEndsAt > 0 && <Timer timerEnd={introEndsAt} total={introMs / 1000} label="Tiempo para mirar" />}
      </div>
      <div className="controls">{controls}</div>
      {overlay}
    </div>
  );
}
