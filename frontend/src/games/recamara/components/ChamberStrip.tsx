import { SoundToggle } from "./SoundToggle";

interface ChamberStripProps {
  roundNumber: number;
  direction: 1 | -1;
  muted: boolean;
  onToggleMute: () => void;
}

// The strip right above the table: the mute toggle on the left, the round
// in the middle and the turn direction on the right.
export function ChamberStrip({ roundNumber, direction, muted, onToggleMute }: ChamberStripProps) {
  return (
    <div className="chamber-strip">
      <div className="chamber-strip-left">
        <SoundToggle muted={muted} onToggle={onToggleMute} />
      </div>
      <div className="chamber-strip-center">
        <span className="chamber-round">Ronda {roundNumber}</span>
      </div>
      <span className="direction-tag" title={direction === 1 ? "Sentido horario" : "Sentido antihorario"}>
        {direction === 1 ? "↻" : "↺"}
      </span>
    </div>
  );
}
