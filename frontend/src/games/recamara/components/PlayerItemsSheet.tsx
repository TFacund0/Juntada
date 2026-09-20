import { ITEM_LABEL, type ItemKind, type Player } from "@juntada/recamara-engine";

interface PlayerItemsSheetProps {
  player: Player;
  // Only the player whose turn it is can actually use an item — everyone
  // else (including peeking at your own items mid-opponent's-turn) gets a
  // read-only look, per "presionando cada jugador podamos ver los items".
  interactive: boolean;
  onUseItem?: (item: ItemKind) => void;
  onClose: () => void;
}

export function PlayerItemsSheet({ player, interactive, onUseItem, onClose }: PlayerItemsSheetProps) {
  return (
    <div className="rec-overlay rec-overlay-sheet" onClick={onClose}>
      <div className="rec-sheet" onClick={e => e.stopPropagation()}>
        <div className="rec-sheet-head">
          <b>{player.name}</b>
          <button className="icon-btn" onClick={onClose} title="Cerrar">
            ✕
          </button>
        </div>
        {player.items.length === 0 ? (
          <p className="rec-sheet-empty">No tiene ítems.</p>
        ) : (
          <div className="rec-sheet-grid">
            {player.items.map((item, i) => (
              <button
                key={i}
                type="button"
                className={`rec-sheet-item${interactive ? " usable" : ""}`}
                onClick={() => interactive && onUseItem?.(item)}
                disabled={!interactive}
              >
                <span className="icon">{item}</span>
                <span className="label">{ITEM_LABEL[item]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
