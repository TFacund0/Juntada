import type { CSSProperties } from "react";
import type { PlayingFx } from "../utils/playingFx";
import { ShellIcon } from "./ShellIcon";

// The short scene an item plays before its result banner (see itemFxMs for
// how long each one lasts): the saw throwing sparks, the magnifier sliding
// over the next shell, the cigarette smoking a life back. Everything else
// keeps the plain icon pulse. Replaces the old ItemActivatingOverlay.
const SPARKS = Array.from({ length: 12 }, (_, i) => i);
const PUFFS = Array.from({ length: 5 }, (_, i) => i);

export function ItemEffect({ fx }: { fx: PlayingFx }) {
  return (
    <div className="rec-overlay">
      <div className="rec-modal item-fx" role="status">
        {fx.item === "🪚" ? (
          <SawFx />
        ) : fx.item === "🔍" ? (
          <LensFx fx={fx} />
        ) : fx.item === "🚬" ? (
          <CigFx healed={!!fx.healed} />
        ) : (
          <PulseFx icon={fx.item} />
        )}
      </div>
    </div>
  );
}

function PulseFx({ icon }: { icon?: string }) {
  return <span className="rec-modal-icon activating">{icon}</span>;
}

function SawFx() {
  return (
    <>
      <div className="item-fx-stage">
        <span className="item-fx-saw" aria-hidden="true">
          🪚
        </span>
        {SPARKS.map(i => (
          <i key={i} className="item-fx-spark" style={{ "--a": `${i * 30}deg`, "--d": `${i * 55}ms` } as CSSProperties} />
        ))}
      </div>
      <p className="item-fx-text">Recortando el caño</p>
    </>
  );
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

function CigFx({ healed }: { healed: boolean }) {
  return (
    <>
      <div className="item-fx-stage">
        <span className="item-fx-cig" aria-hidden="true">
          🚬
        </span>
        {PUFFS.map(i => (
          <i
            key={i}
            className="item-fx-puff"
            style={{ "--d": `${i * 120}ms`, "--dx": `${(i % 2 ? 1 : -1) * (10 + i * 6)}px` } as CSSProperties}
          />
        ))}
        {healed && <span className="item-fx-life" aria-hidden="true" />}
      </div>
      <p className="item-fx-text">{healed ? "+1 vida" : "Ya tenía todas las vidas"}</p>
    </>
  );
}
