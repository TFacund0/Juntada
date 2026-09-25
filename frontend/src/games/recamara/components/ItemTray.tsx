import { ITEM_LABEL, type ItemKind } from "@juntada/recamara-engine";

interface ItemTrayProps {
  items: ItemKind[];
  disabled: boolean;
  // Per item: whether it can be used right now (e.g. a second 🧤 in the same
  // turn can't — see the engine's canUseItem).
  isUsable?: (item: ItemKind) => boolean;
  onUse: (item: ItemKind) => void;
}

// The acting player's items as big buttons with their name underneath (the
// reference's #tray) — only while it's their turn. The short name is the
// part of ITEM_LABEL before its " — " description; the full description
// shows once the item is pressed (ItemUseModal), never on hover.
export function ItemTray({ items, disabled, isUsable = () => true, onUse }: ItemTrayProps) {
  if (items.length === 0) return null;
  return (
    <div className="item-tray">
      {items.map((item, i) => {
        const [name] = ITEM_LABEL[item].split(" — ");
        const usable = isUsable(item);
        return (
          <button
            key={i}
            type="button"
            className="tray-item"
            disabled={disabled || !usable}
            onClick={() => onUse(item)}
            aria-label={usable ? name : `${name} (ya usado este turno)`}
          >
            <span aria-hidden="true">{item}</span>
            <small aria-hidden="true">{name}</small>
          </button>
        );
      })}
    </div>
  );
}
