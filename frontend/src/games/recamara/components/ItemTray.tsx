import { ITEM_LABEL, type ItemKind } from "@juntada/recamara-engine";

// The acting player's items as big buttons with their name underneath (the
// reference's #tray) — only while it's their turn. The short name is the
// part of ITEM_LABEL before its " — " description; the full description
// shows once the item is pressed (ItemUseModal), never on hover.
export function ItemTray({ items, disabled, onUse }: { items: ItemKind[]; disabled: boolean; onUse: (item: ItemKind) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="item-tray">
      {items.map((item, i) => {
        const [name] = ITEM_LABEL[item].split(" — ");
        return (
          <button key={i} type="button" className="tray-item" disabled={disabled} onClick={() => onUse(item)} aria-label={name}>
            <span aria-hidden="true">{item}</span>
            <small aria-hidden="true">{name}</small>
          </button>
        );
      })}
    </div>
  );
}
