import clsx from "clsx";
import { T } from "../../../theme/styles/classes";

// Ta-Te-Ti has no rules to tweak — this just fills the contract's slot in the
// multiplayer lobby with a short note instead of an empty gap.
export function ConfigPanel() {
  return (
    <div className={clsx(T.card, "text-center")}>
      <p className={T.muted}>Sin configuración — el clásico 3 en raya. Arrancá cuando estén los dos.</p>
    </div>
  );
}
