import { S } from "../theme/styles";
import { Avatar } from "./Avatar";

// A host-picked order (room.config.turnOrder) is only ever a hint — drop
// anyone who's since left, and append anyone who joined after in room-list
// order, so a stale/partial order never silently drops a player from the
// list. Exported since a game's own round-start logic may need the exact
// same reconciliation the config preview uses (e.g. quien-soy's backend
// engine mirrors this independently server-side, since only the server can
// be trusted to apply it at round start — but the shape/rule is identical).
export function resolveTurnOrder(players: { id: string }[], turnOrder: string[] | undefined): string[] {
  const ids = players.map(p => p.id);
  const kept = (turnOrder || []).filter(id => ids.includes(id));
  const missing = ids.filter(id => !kept.includes(id));
  return [...kept, ...missing];
}

// Host-only turn-order editor for a multiplayer lobby: a reorderable list
// (avatar + name + ↑/↓) built from resolveTurnOrder, with an optional
// random/manual toggle for games where an empty turnOrder means "shuffle it"
// server-side (see the `allowRandom` prop) — shared between quien-soy and
// limon-limon's ConfigPanels instead of two hand-rolled copies of the same
// list/reorder markup.
export function TurnOrderEditor({
  players,
  turnOrder,
  onChange,
  allowRandom = false,
  label = "Orden de turno",
  helpText,
}: {
  players: { id: string; name: string }[];
  turnOrder: string[] | undefined;
  onChange: (order: string[]) => void;
  allowRandom?: boolean;
  label?: string;
  helpText?: string;
}) {
  const order = resolveTurnOrder(players, turnOrder);
  const manual = !allowRandom || (turnOrder?.length ?? 0) > 0;
  const rows = order.map(id => players.find(p => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div style={S.card}>
      <span style={S.label}>{label}</span>
      {helpText && <p style={{ ...S.muted, margin: "0 0 10px", lineHeight: 1.4 }}>{helpText}</p>}

      {allowRandom && (
        <div style={{ display: "flex", gap: 8, marginBottom: manual ? 12 : 0 }}>
          <button onClick={() => onChange([])} style={{ ...S.btn(!manual ? "primary" : "ghost"), flex: 1, padding: "8px", fontSize: 13 }}>
            Al azar
          </button>
          <button onClick={() => onChange(order)} style={{ ...S.btn(manual ? "primary" : "ghost"), flex: 1, padding: "8px", fontSize: 13 }}>
            Orden manual
          </button>
        </div>
      )}

      {manual && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
              <span style={{ width: 18, fontSize: 12, fontWeight: 800, color: "#6b6490" }}>{i + 1}</span>
              <Avatar name={p.name} size={28} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{p.name}</span>
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                style={{ ...S.btn("ghost"), width: 32, height: 32, padding: 0, borderRadius: 8, fontSize: 14, opacity: i === 0 ? 0.35 : 1 }}
              >
                ↑
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === rows.length - 1}
                style={{
                  ...S.btn("ghost"),
                  width: 32,
                  height: 32,
                  padding: 0,
                  borderRadius: 8,
                  fontSize: 14,
                  opacity: i === rows.length - 1 ? 0.35 : 1,
                }}
              >
                ↓
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
