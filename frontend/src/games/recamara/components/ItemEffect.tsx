import type { PlayingFx } from "../utils/playingFx";
import { ShellIcon } from "./ShellIcon";

// The short scene an item plays before its result banner, when it needs
// the whole screen (see itemFxMs for how long each one lasts): the
// magnifier sliding over the next shell, like the reference's #lens
// overlay. The 🪚 and the 🚬 play on the table itself instead (see
// SceneItemFx); everything else keeps the plain icon pulse.
export function ItemEffect({ fx }: { fx: PlayingFx }) {
  if (fx.item === "🪚" || fx.item === "🚬") return null;
  return (
    <div className="rec-overlay">
      <div className="rec-modal item-fx" role="status">
        {fx.item === "🔍" ? <LensFx fx={fx} /> : <PulseFx icon={fx.item} />}
      </div>
    </div>
  );
}

function PulseFx({ icon }: { icon?: string }) {
  return <span className="rec-modal-icon activating">{icon}</span>;
}

// Only the item's user ever gets `revealedShellKind` (online it comes from
// their private_role, see onlinePlayingFx) — everyone else sees a face-down
// shell and is told someone looked.
function LensFx({ fx }: { fx: PlayingFx }) {
  const kind = fx.revealedShellKind ?? null;
  return (
    <>
      <div className="item-fx-stage lens">
        <ShellIcon kind={null} className="lens-shell" />
        {kind && <ShellIcon kind={kind} className="lens-shell lens-real" />}
        <span className="lens-ring" aria-hidden="true" />
      </div>
      {kind ? (
        <p className="item-fx-text">
          {kind === "live" ? "Real" : "Falsa"}
          <small>Solo vos la viste</small>
        </p>
      ) : (
        <p className="item-fx-text">
          {fx.actorName ? `${fx.actorName} miró la próxima bala` : "Alguien miró la próxima bala"}
          <small>Vos no sabés qué vio</small>
        </p>
      )}
    </>
  );
}
