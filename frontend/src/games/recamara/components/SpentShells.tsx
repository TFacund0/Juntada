import type { CSSProperties } from "react";
import type { SpentShell } from "../hooks/shotAnimation";

// The last empty casing lying on the table. It's positioned at its landing
// spot and flies there from the gun in a 3D arc — up off the felt,
// tumbling, a small bounce — the moment it's added (see .spent-shell in
// effects.css). Any older casing fades away as the new one lands, so the
// table never shows how many shells have been fired. Keyed by id, so a
// casing already on the table never replays its throw.
export function SpentShells({ shells }: { shells: SpentShell[] }) {
  return (
    <>
      {shells.map((shell, i) => (
        <span
          key={shell.id}
          className={`spent-shell ${shell.kind}${i < shells.length - 1 ? " fading" : ""}`}
          title={shell.kind === "live" ? "Cartucho real" : "Cartucho falso"}
          style={
            {
              // Landing spot as table percentages; the keyframes start at the
              // gun (the table's center) and travel here.
              "--x": `${shell.left}%`,
              "--y": `${shell.top}%`,
              "--rot": `${shell.rot}deg`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}
