import { ITEM_LABEL, ITEMS_PER_RELOAD, MAX_ITEMS, type ItemKind, type Player } from "@juntada/recamara-engine";

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
      ) : total === 0 ? (
        <p className="chest-anticipation">Nada esta vez — no había lugar para ningún ítem nuevo.</p>
      ) : (
        <p className="chest-anticipation">¿Qué habrá en el cofre?</p>
      )}

      <p className="chest-progress mono">{done ? "Cofre vacío" : `Tocá para abrir · ${revealedCount}/${total}`}</p>

      {/* A full (or nearly full) inventory just misses out on whatever
          doesn't fit — see @juntada/recamara-engine's reloadIfNeeded —
          nothing already held ever gets bumped to make room. That's
          invisible from newItems alone (it's just a shorter chest), so
          spell it out explicitly whenever this reload granted fewer than
          the usual ITEMS_PER_RELOAD. */}
      {done && total < ITEMS_PER_RELOAD && (
        <p className="chest-full-warning">
          {total === 0
            ? `Inventario lleno (${MAX_ITEMS}/${MAX_ITEMS}) — no pudiste sumar ningún ítem nuevo. Usá alguno para hacer lugar.`
            : `Inventario casi lleno — solo entró ${total} de ${ITEMS_PER_RELOAD} ítems nuevos. Usá alguno para hacer lugar la próxima vez.`}
        </p>
      )}

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
