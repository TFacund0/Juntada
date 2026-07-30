// Sits behind the players around the arena — a slowly spinning dashed ring,
// plus a few chevrons riding it pointing the way it spins, so the turn
// order's direction reads as a physical, at-a-glance thing instead of just
// the small ↻/↺ glyph in the turn-banner (still there too, for anyone who
// wants it in text). Direction only ever flips via the 🔄 item, so this
// doesn't need to react to anything beyond that single prop.
const CHEVRON_ANGLES = [0, 90, 180, 270]; // clockwise degrees from the top

interface DirectionRingProps {
  direction: 1 | -1;
}

export function DirectionRing({ direction }: DirectionRingProps) {
  const cw = direction === 1;
  return (
    <div className={`direction-ring${cw ? " cw" : " ccw"}`} aria-hidden="true">
      {CHEVRON_ANGLES.map(angle => {
        const rad = (angle * Math.PI) / 180;
        const left = 50 + 50 * Math.sin(rad);
        const top = 50 - 50 * Math.cos(rad);
        // A chevron at this point tangent to the circle: pointing "angle"
        // itself when the ring spins clockwise (a chevron sitting at the
        // top of the circle travels rightward first), or the opposite way
        // round when it spins counter-clockwise.
        const rotate = cw ? angle : angle + 180;
        return (
          <span
            key={angle}
            className="direction-chevron"
            style={{ left: `${left}%`, top: `${top}%`, transform: `translate(-50%, -50%) rotate(${rotate}deg)` }}
          >
            ▸
          </span>
        );
      })}
    </div>
  );
}
