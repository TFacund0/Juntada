import type { ShellKind } from "@juntada/recamara-engine";

interface ChamberStripProps {
  roundNumber: number;
  // Chamber size and shells still in it — public, only the order is secret.
  shellsTotal: number;
  shellsLeft: number;
  // What this device saw with the 🔍, until the next shot (see useKnownShell).
  known: ShellKind | null;
  direction: 1 | -1;
}

// The strip above the table (the reference's #chamber): round number, one
// mini shell per shell still loaded — face-down, just a count — and a pill
// with what the 🔍 revealed, only on the device that used it.
export function ChamberStrip({ roundNumber, shellsTotal, shellsLeft, known, direction }: ChamberStripProps) {
  return (
    <div className="chamber-strip">
      <span className="chamber-round">Ronda {roundNumber}</span>
      <span className="chamber-minis" role="img" aria-label={`${shellsLeft} cartuchos en la recámara`}>
        {/* Fired ones stay mounted as .gone so they can drop out (mini-out). */}
        {Array.from({ length: shellsTotal }, (_, i) => (
          <span key={i} className={`mini${i < shellsTotal - shellsLeft ? " gone" : ""}`} />
        ))}
      </span>
      {known && <span className={`chamber-known ${known}`}>{known === "live" ? "La próxima es REAL" : "La próxima es FALSA"}</span>}
      <span className="direction-tag" title={direction === 1 ? "Sentido horario" : "Sentido antihorario"}>
        {direction === 1 ? "↻" : "↺"}
      </span>
    </div>
  );
}
