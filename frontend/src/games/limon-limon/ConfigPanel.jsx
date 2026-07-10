import { S } from "../../theme/styles";
import { Avatar } from "../../components/Avatar";
import { Toggle } from "../../components/Toggle";
import { effectiveOrder } from "./deck";
import { DescriptionsEditor } from "./DescriptionsEditor";

// Host-only, se muestra en el lobby: define el orden de turno (arranca en
// orden de llegada, pero se puede reordenar), si el resto puede espiar el
// puntaje durante la ronda, y el significado de cada carta.
export function ConfigPanel({ room, updateConfig }) {
  const descriptions = room.config.descriptions || {};
  const order = effectiveOrder(room.players, room.config.turnOrder);
  const players = order.map(id => room.players.find(p => p.id === id)).filter(Boolean);

  const move = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    updateConfig({ turnOrder: next });
  };

  return (
    <div>
      <div style={S.card}>
        <span style={S.label}>Orden de turno</span>
        <p style={{ ...S.muted, marginTop: -6, marginBottom: 12 }}>Así van a ir pasando el mazo. Los que se sumen después entran al final.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {players.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
              <span style={{ width: 18, fontSize: 12, fontWeight: 800, color: "#6b6490" }}>{i + 1}</span>
              <Avatar name={p.name} size={28} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{p.name}</span>
              <button onClick={() => move(i, -1)} disabled={i === 0} style={{ ...S.btn("secondary"), width: 32, height: 32, padding: 0, borderRadius: 8, fontSize: 14, opacity: i === 0 ? 0.35 : 1 }}>↑</button>
              <button onClick={() => move(i, 1)} disabled={i === players.length - 1} style={{ ...S.btn("secondary"), width: 32, height: 32, padding: 0, borderRadius: 8, fontSize: 14, opacity: i === players.length - 1 ? 0.35 : 1 }}>↓</button>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <Toggle
          label={room.config.showScoreToPlayers ? "Todos pueden ver el puntaje durante la ronda" : "Solo el anfitrión puede ver el puntaje durante la ronda"}
          value={!!room.config.showScoreToPlayers}
          onChange={v => updateConfig({ showScoreToPlayers: v })}
        />
      </div>

      <DescriptionsEditor descriptions={descriptions} onChange={(key, value) => updateConfig({ descriptions: { ...descriptions, [key]: value } })} />
    </div>
  );
}
