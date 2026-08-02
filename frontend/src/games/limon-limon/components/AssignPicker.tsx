import { S } from "../../../theme/styles";
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
      <span style={{ ...S.label, textAlign: "center", display: "block" }}>¿Quién se la queda?</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
        {players.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            style={{
              ...S.btn(selected === p.id ? "primary" : "ghost"),
              display: "flex",
              alignItems: "center",
              gap: 10,
              justifyContent: "flex-start",
              padding: "10px 14px",
            }}
          >
            <Avatar name={p.name} size={26} />
            <span>{p.name}</span>
          </button>
        ))}
      </div>
      <Btn variant="success" disabled={selected == null} onClick={onConfirm} style={{ marginTop: 10 }}>
        Confirmar
      </Btn>
      {selected == null && <p style={{ ...S.muted, textAlign: "center", marginTop: 6, fontSize: 12 }}>Elegí a alguien primero</p>}
    </>
  );
}
