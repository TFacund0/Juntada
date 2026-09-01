import clsx from "clsx";
import { T } from "../../../theme/styles/classes";

// Shared by both local modes (circle and reveal) — same full-width "Ver
// puntaje" / "Ocultar puntaje" toggle, so the ranking panel below it opens
// and closes the same way regardless of which mode is running.
export function ScoreToggleButton({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <div className="my-3.5">
      <button onClick={onToggle} className={clsx(T.btn("ghost"), "text-[13px]")}>
        {show ? "Ocultar puntaje" : "Ver puntaje"}
      </button>
    </div>
  );
}
