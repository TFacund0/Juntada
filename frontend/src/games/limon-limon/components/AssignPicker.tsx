import clsx from "clsx";
import { T as UI } from "../../../theme/styles/classes";
import { Btn } from "../../../components/ui/Btn";
import { Avatar } from "../../../components/ui/Avatar";

// Shared between local (pass-and-play) and online: picking who eats the
// revealed card is two steps, not one tap — select a player (highlighted,
// not yet committed), then a separate "Confirmar" actually assigns it. Keeps
// a stray tap from instantly handing someone a card.
export function AssignPicker<T extends string | number>({
  players,
  selected,
  onSelect,
  onConfirm,
}: {
  players: { id: T; name: string }[];
  selected: T | null;
  onSelect: (id: T) => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <span className={clsx(UI.label, "text-center block")}>¿Quién se la queda?</span>
      <div className="flex flex-col gap-2 mt-1.5">
        {players.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={clsx(UI.btn(selected === p.id ? "primary" : "ghost"), "flex items-center gap-2.5 justify-start px-3.5 py-2.5")}
          >
            <Avatar name={p.name} size={26} />
            <span>{p.name}</span>
          </button>
        ))}
      </div>
      <Btn variant="success" disabled={selected == null} onClick={onConfirm} style={{ marginTop: 10 }}>
        Confirmar
      </Btn>
      {selected == null && <p className={clsx(UI.muted, "text-center mt-1.5 text-xs")}>Elegí a alguien primero</p>}
    </>
  );
}
