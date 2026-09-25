import { useId } from "react";

interface ShotgunProps {
  // Aiming: trembles right before the trigger (see .shotgun.aiming).
  aiming?: boolean;
  recoil?: boolean;
  flash?: boolean;
  sawed?: boolean;
}

// The shotgun, drawn in SVG (ported from docs/referencias/recamara-referencia.html):
// wooden stock, receiver, barrel with its wooden pump, and a muzzle flash
// that stays invisible until `flash`. Points right (+x), so rotating its
// container by seatAngle aims it at that seat. The 🪚 shortens the barrel
// and pulls the muzzle flash back with it (see shotgun-banner.css).
//
// Gradient ids go through useId so two shotguns mounted at once (e.g. a
// test rendering both screens) never resolve each other's fills.
export function Shotgun({ aiming = false, recoil = false, flash = false, sawed = false }: ShotgunProps) {
  const id = useId().replace(/:/g, "");
  const metal = `${id}-metal`;
  const wood = `${id}-wood`;
  const fire = `${id}-fire`;

  return (
    <div className={`shotgun${aiming ? " aiming" : ""}${recoil ? " recoil" : ""}${sawed ? " sawed" : ""}`}>
      <svg className="shotgun-svg" viewBox="0 0 220 44" aria-hidden="true">
        <defs>
          <linearGradient id={metal} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8a8378" />
            <stop offset=".45" stopColor="#4d4840" />
            <stop offset="1" stopColor="#23201b" />
          </linearGradient>
          <linearGradient id={wood} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8a5c38" />
            <stop offset=".5" stopColor="#6b4228" />
            <stop offset="1" stopColor="#3d2616" />
          </linearGradient>
          <radialGradient id={fire}>
            <stop offset="0" stopColor="#fff8dc" />
            <stop offset=".35" stopColor="#ffd36b" />
            <stop offset=".7" stopColor="#ff6a2e" />
            <stop offset="1" stopColor="#ff4d3d" stopOpacity="0" />
          </radialGradient>
        </defs>

        <path d="M4 11 Q1 22 4 33 L58 29 L72 27 L72 17 L58 15 Z" fill={`url(#${wood})`} />
        <path d="M8 13 L56 16" stroke="rgba(0,0,0,.25)" strokeWidth="1" />
        <g className="shotgun-barrel">
          <rect x="106" y="23.5" width="80" height="4.5" rx="2" fill="#2a2620" />
          <rect x="106" y="16.5" width="108" height="6.5" rx="2.5" fill={`url(#${metal})`} />
          <rect x="210" y="16" width="4" height="7.5" rx="1" fill="#1a1713" />
        </g>
        <rect x="70" y="14" width="40" height="16" rx="3" fill={`url(#${metal})`} />
        <rect x="76" y="18" width="18" height="4" rx="1" fill="#1a1713" />
        <path d="M84 30 q6 6 12 0" stroke="#2a2620" strokeWidth="2.5" fill="none" />
        <rect x="124" y="14.5" width="42" height="15" rx="4" fill={`url(#${wood})`} />
        <path d="M131 15 v14 M137 15 v14 M143 15 v14 M149 15 v14 M155 15 v14" stroke="rgba(0,0,0,.28)" strokeWidth="1.4" />
        {/* Outer group follows the barrel when sawed; inner one plays the flash. */}
        <g className="shotgun-muzzle">
          <g className={`shotgun-muzzle-fire${flash ? " flash" : ""}`}>
            <path d="M214 20 L236 8 L230 18 L252 20 L230 23 L238 34 Z" fill={`url(#${fire})`} />
            <circle cx="222" cy="20" r="11" fill={`url(#${fire})`} />
          </g>
        </g>
      </svg>
      {/* Smoke drifting up off the muzzle after a live shot; remounted by
          each new flash so it replays every time. */}
      {flash && (
        <span className="gun-smoke" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      )}
    </div>
  );
}
