import type { ShellKind } from "@juntada/recamara-engine";

// A shotgun shell seen from the side (ported from the reference's
// #shellSide symbol): colored hull + brass base. `kind` null draws it
// face-down — the neutral hull a shell shows once its color is secret.
export function ShellIcon({ kind, className = "" }: { kind: ShellKind | null; className?: string }) {
  return (
    <svg className={`shell-icon ${kind ?? "hidden"} ${className}`.trim()} viewBox="0 0 30 74" aria-hidden="true">
      <rect className="shell-hull" x="3" y="3" width="24" height="50" rx="5" />
      <rect x="3" y="3" width="24" height="50" rx="5" fill="rgba(255,255,255,.12)" />
      <line x1="3" y1="10" x2="27" y2="10" stroke="rgba(0,0,0,.25)" strokeWidth="1.5" />
      <rect className="shell-brass" x="1" y="51" width="28" height="6" rx="1.5" />
      <rect className="shell-brass" x="3" y="56" width="24" height="15" rx="2" />
      <circle cx="15" cy="71" r="3" fill="#6d5626" />
    </svg>
  );
}
