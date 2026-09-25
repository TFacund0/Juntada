import { useEffect, useRef, useState } from "react";
import { ITEM_LABEL, ITEMS_PER_RELOAD, MAX_ITEMS, type ItemKind } from "@juntada/recamara-engine";
import type { RecamaraSfx } from "../hooks/recamaraSfx";
import { CHEST_DONE_AUTO_MS, CHEST_IDLE_MS } from "../utils/timing";

export interface ChestTurn {
  // Whose chest it is; null for this device's own (online).
  ownerName: string | null;
  // What this reload actually granted them (Player.lastGrantedItems).
  items: ItemKind[];
  // Their inventory is at MAX_ITEMS, so part (or all) of the reload
  // didn't fit — see @juntada/recamara-engine's reloadIfNeeded.
  inventoryFull: boolean;
}

interface ItemChestProps extends ChestTurn {
  sfx?: RecamaraSfx;
  onDone: () => void;
}

// The new items after a reload, one per tap: the chest wobbles, and each tap
// makes it jump and pops the next item out of it — a card with the item's
// name over turning light rays — into its slot in the row below. Once it's
// empty the lid stays open and a tap (or a short beat) moves on. If nobody
// taps for a while it opens the next one by itself, so an idle player never
// holds up the rest of the table online.
// Layout and type are Tailwind; the chest itself (wood, brass, lid) and
// every animation live in css/chest.css.
export function ItemChest({ ownerName, items, inventoryFull, sfx, onDone }: ItemChestProps) {
  const [opened, setOpened] = useState(0);
  const total = items.length;
  const done = opened >= total;
  const last = opened > 0 ? items[opened - 1] : null;

  const latest = useRef(onDone);
  useEffect(() => {
    latest.current = onDone;
  });
  const finished = useRef(false);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    latest.current();
  };
  const openNext = () => {
    if (done) return;
    setOpened(n => Math.min(n + 1, total));
    sfx?.play("pop");
    sfx?.vibrate(25);
  };

  useEffect(() => {
    const t = setTimeout(done ? finish : openNext, done ? CHEST_DONE_AUTO_MS : CHEST_IDLE_MS);
    return () => clearTimeout(t);
    // Restarts on every opened item: the idle clock counts from the last tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, done]);

  const [name, desc] = last ? ITEM_LABEL[last].split(" — ") : [];

  return (
    <div className="chest flex w-[min(340px,100%)] flex-col items-center gap-2.5">
      <p className="m-0 text-[0.95rem] text-rec-ink-dim">
        {ownerName ? (
          <>
            Caja de <b className="text-rec-ink">{ownerName}</b>
          </>
        ) : (
          "Tu caja"
        )}
      </p>

      {/* Room above the chest for the prize to pop up into. */}
      <div className="relative flex h-[300px] w-full items-end justify-center">
        {last && (
          <div
            key={opened}
            className="chest-prize absolute top-0 left-1/2 z-3 -ml-[110px] flex w-[220px] flex-col items-center"
            role="status"
          >
            <span className="chest-prize-rays" aria-hidden="true" />
            <span className="text-[3.4rem] leading-none drop-shadow-[0_0_14px_rgba(255,215,110,0.8)]" aria-hidden="true">
              {last}
            </span>
            <span className="chest-prize-name display mt-2 text-[1.6rem] leading-none text-rec-gold [text-shadow:0_2px_0_#5e4411]">
              {name}
            </span>
            {desc && <span className="mt-1 text-[0.8rem] leading-[1.35] text-rec-ink-dim">{desc}</span>}
          </div>
        )}
        <button
          type="button"
          className={`chest-box relative h-[128px] w-[150px] cursor-pointer border-0 bg-transparent p-0 [-webkit-tap-highlight-color:transparent] focus-visible:rounded-xl focus-visible:outline-2 focus-visible:outline-offset-[6px] focus-visible:outline-rec-blank${done ? " open" : ""}${total === 0 ? " empty" : ""}`}
          onClick={done ? finish : openNext}
          aria-label={done ? "Continuar" : `Abrir la caja, ${opened} de ${total}`}
        >
          {/* Re-keyed per tap so the jump replays on every item. */}
          <span key={opened} className={`chest-body-wrap${opened > 0 ? " jolt" : ""}`} aria-hidden="true">
            <span className="chest-glow" />
            <span className="chest-lid" />
            <span className="chest-body">
              <span className="chest-lock" />
            </span>
          </span>
        </button>
      </div>

      {total > 0 && (
        <div className="flex gap-2" role="group" aria-label={`${opened} de ${total} ítems`}>
          {items.map((it, i) => (
            <span
              key={i}
              className={`chest-slot grid aspect-square w-[var(--rec-box-md)] place-items-center rounded-lg border bg-rec-bg-raised text-[1.3rem] ${
                i < opened
                  ? "filled border-solid border-rec-brass shadow-[0_0_12px_-2px_rgba(255,215,110,0.55)]"
                  : "border-dashed border-rec-hair text-rec-ink-faint"
              }`}
              title={i < opened ? ITEM_LABEL[it] : undefined}
            >
              {i < opened ? it : "?"}
            </span>
          ))}
        </div>
      )}

      {done && inventoryFull && total < ITEMS_PER_RELOAD && (
        <p className="m-0 max-w-[280px] text-[0.8rem] leading-[1.4] text-rec-blank">
          {total === 0
            ? `Inventario lleno (${MAX_ITEMS}/${MAX_ITEMS}): esta vez no entró ningún ítem.`
            : `Inventario lleno (${MAX_ITEMS}/${MAX_ITEMS}): solo entró ${total} de ${ITEMS_PER_RELOAD}.`}
        </p>
      )}

      <p className="m-0 text-[0.72rem] tracking-[0.08em] text-rec-ink-faint uppercase">{done ? "tocá para seguir" : "tocá la caja"}</p>
    </div>
  );
}
