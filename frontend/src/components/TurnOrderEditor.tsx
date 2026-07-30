import { S } from "../theme/styles";
import { Avatar } from "./Avatar";

/**
 * Un orden elegido por el host (`room.config.turnOrder`) es siempre solo
 * una sugerencia — se descarta a cualquiera que ya se fue, y se agrega al
 * final a cualquiera que se sumó después, en el orden de la lista de la
 * sala, así un orden desactualizado/parcial nunca hace que un jugador
 * desaparezca en silencio de la lista. Se exporta porque la lógica propia
 * de arranque de ronda de un juego puede necesitar exactamente la misma
 * reconciliación que usa la vista previa de config (ej. el motor de
 * backend de "¿Quién Soy?" replica esto de forma independiente del lado
 * del servidor, ya que solo el servidor puede aplicarlo con confianza al
 * arrancar la ronda — pero la forma/regla es idéntica).
 */
export function resolveTurnOrder(players: { id: string }[], turnOrder: string[] | undefined): string[] {
  const ids = players.map(p => p.id);
  const kept = (turnOrder || []).filter(id => ids.includes(id));
  const missing = ids.filter(id => !kept.includes(id));
  return [...kept, ...missing];
}

/**
 * Editor de orden de turno, exclusivo del host, para un lobby multijugador:
 * una lista reordenable (avatar + nombre + ↑/↓) construida a partir de
 * `resolveTurnOrder`, con un toggle opcional de azar/manual para juegos
 * donde un `turnOrder` vacío significa "mezclalo" del lado del servidor
 * (ver la prop `allowRandom`) — compartido entre los `ConfigPanel` de
 * "¿Quién Soy?" y limón-limón en vez de dos copias hechas a mano del mismo
 * markup de lista/reordenamiento.
 */
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
              <span style={{ width: 18, fontSize: 12, fontWeight: 800, color: "var(--jt-muted-text)" }}>{i + 1}</span>
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
