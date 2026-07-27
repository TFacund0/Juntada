import type { LogLine } from "@juntada/recamara-engine";

interface OutcomeBannerProps {
  // Item use: a single neutral-colored line. Firing: an extra second line
  // (the real/falso verdict) that gets its own color, shown under the
  // neutral "who shot whom" line.
  line: LogLine;
  subLine?: LogLine;
  onContinue: () => void;
}

// Big centered alert shown after a shot resolves or an item gets used —
// stays up until the player taps through, so the pacing of "what just
// happened" is entirely in their hands instead of an arbitrary timer.
export function OutcomeBanner({ line, subLine, onContinue }: OutcomeBannerProps) {
  return (
    <div className="rec-overlay">
      <div className={`rec-modal rec-banner${subLine ? "" : line.cls ? ` ${line.cls}` : ""}${subLine ? ` ${subLine.cls}` : ""}`}>
        <p className="rec-banner-text" dangerouslySetInnerHTML={{ __html: line.text }} />
        {subLine && <p className={`rec-banner-subtext ${subLine.cls}`} dangerouslySetInnerHTML={{ __html: subLine.text }} />}
        <button className="act primary" onClick={onContinue}>
          Continuar
        </button>
      </div>
    </div>
  );
}
