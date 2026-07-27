import { ITEM_LABEL, type ItemKind, type Player } from "@juntada/recamara-engine";

interface ChestRevealProps {
  player: Player;
  // Items this player just gained this reload — the chest "contains" only
  // these. One per tap, Clash Royale style: each press pops the next item
  // out instead of dumping the whole handful at once.
  newItems: ItemKind[];
  revealedCount: number;
  onReveal: () => void;
}

// One big chest, center stage, for whoever's turn it is to claim their new
// items — LocalGame cycles through players one at a time during "reveal"
// (see its revealTurn/revealedCount state). Purely presentational timing:
// the items are already in game state the moment the reload happens, this
// just delays *showing* them for effect.
export function ChestReveal({ player, newItems, revealedCount, onReveal }: ChestRevealProps) {
  const total = newItems.length;
  const done = revealedCount >= total;
  const lastRevealed = revealedCount > 0 ? newItems[revealedCount - 1] : null;

  return (
    <div className="chest-stage">
      <p className="chest-title">
        Cofre de <b>{player.name}</b>
      </p>

      <div className={`chest-big${done ? " empty" : " shake"}`} onClick={() => !done && onReveal()} role="button" tabIndex={done ? -1 : 0}>
        <span className="chest-big-box">{done ? "📭" : "🎁"}</span>
        {!done && <span className="chest-glow" />}
      </div>

      {lastRevealed ? (
        <div className="chest-reveal-card" key={revealedCount}>
          <span className="chest-reveal-icon">{lastRevealed}</span>
          <span className="chest-reveal-label">{ITEM_LABEL[lastRevealed]}</span>
        </div>
      ) : (
        <p className="chest-anticipation">¿Qué habrá en el cofre?</p>
      )}

      <p className="chest-progress mono">{done ? "Cofre vacío" : `Tocá para abrir · ${revealedCount}/${total}`}</p>

      {revealedCount > 0 && (
        <div className="chest-collected">
          {newItems.slice(0, revealedCount).map((it, i) => (
            <span className="chest-collected-item" key={i} title={ITEM_LABEL[it]}>
              {it}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
