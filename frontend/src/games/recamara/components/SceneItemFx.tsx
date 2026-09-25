import type { CSSProperties } from "react";

// Item effects that play on the table itself instead of in a modal (the
// reference's useSaw/useCig): the saw works on the gun at the barrel's cut
// point, and the cigarette smokes right over its user's card.

const SPARKS = Array.from({ length: 16 }, (_, i) => i);
const PUFFS = Array.from({ length: 5 }, (_, i) => i);

// Rendered inside .gun-aim, so it turns with the gun; positioned at the
// barrel's cut point (see .saw-on-gun in effects.css).
export function GunSawFx() {
  return (
    <span className="saw-on-gun" aria-hidden="true">
      <span className="saw-on-gun-blade">🪚</span>
      {SPARKS.map(i => (
        <i key={i} className="saw-spark" style={{ "--a": `${(i * 137) % 360}deg`, "--d": `${i * 65}ms` } as CSSProperties} />
      ))}
    </span>
  );
}

// Rendered inside a seat, over the card of whoever used the 🚬.
export function CardSmokeFx() {
  return (
    <span className="card-smoke" aria-hidden="true">
      {PUFFS.map(i => (
        <i key={i} style={{ "--d": `${i * 120}ms`, "--dx": `${(i % 2 ? 1 : -1) * (10 + i * 6)}px` } as CSSProperties} />
      ))}
    </span>
  );
}
