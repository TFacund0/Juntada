import type { ReactNode } from "react";
import { Timer } from "../../../components/game-kit/Timer";

// Beat 3 of "reveal" — the chamber card (gun + real/falso shell count as
// shuffled 🔴/🟡 icons, see shuffledBulletIcons in arena.ts), held up for a
// visible countdown before the duel actually starts. Shared verbatim by
// LocalGame and RoundView; only the button in `controls` differs (local
// starts the duel client-side, online sends `ready_for_duel`).
export function ChamberCard({
  shellCount,
  bulletIcons,
  introEndsAt,
  introMs,
  controls,
  overlay,
  showLegend = false,
}: {
  shellCount: number;
  bulletIcons: string[];
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
      <div className="table round-chamber">
        <div className="chamber-focus">
          <div className="shotgun" style={{ margin: "0 auto 10px" }}>
            <div className="stock" />
            <div className="barrel" />
            <div className="muzzle" />
          </div>
          <div className="bullet-row">
            {bulletIcons.map((icon, i) => (
              <span key={i}>{icon}</span>
            ))}
          </div>
          {showLegend && <p className="bullet-legend mono">🔴 real · 🟡 falsa</p>}
          <p className="shell-count mono">{shellCount} cartuchos en la recámara — el orden es secreto</p>
        </div>
        {introEndsAt > 0 && <Timer timerEnd={introEndsAt} total={introMs / 1000} label="Tiempo para mirar" />}
      </div>
      <div className="controls">{controls}</div>
      {overlay}
    </div>
  );
}
