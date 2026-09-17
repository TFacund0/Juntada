import clsx from "clsx";
import { T } from "../../theme/styles/classes";
import { Avatar } from "../ui/Avatar";

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
  bare = false,
}: {
  players: { id: string; name: string }[];
  turnOrder: string[] | undefined;
  onChange: (order: string[]) => void;
  allowRandom?: boolean;
  label?: string;
  helpText?: string;
  // true cuando un caller ya lo mete adentro de su propia card (ej. el tab
  // "Orden" de ConfigTabs, ver games/impostor) — evita quedar en una card
  // dentro de otra card. Los demás usos (quien-soy, limón-limón) lo dejan
  // como su propio bloque independiente, así que por default trae la suya.
  bare?: boolean;
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
    <div className={bare ? undefined : T.card}>
      <span className={T.label}>{label}</span>
      {helpText && <p className={clsx(T.muted, "m-0 mb-2.5 leading-[1.4]")}>{helpText}</p>}

      {allowRandom && (
        <div className={clsx("flex gap-2", manual ? "mb-3" : "mb-0")}>
          <button onClick={() => onChange([])} className={clsx(T.btn(!manual ? "primary" : "ghost"), "flex-1 p-2 text-[13px]")}>
            Al azar
          </button>
          <button onClick={() => onChange(order)} className={clsx(T.btn(manual ? "primary" : "ghost"), "flex-1 p-2 text-[13px]")}>
            Orden manual
          </button>
        </div>
      )}

      {manual && (
        <div className="flex flex-col gap-1.5">
          {rows.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2.5 py-1.5">
              <span className="w-[18px] text-xs font-extrabold text-[var(--jt-muted-text)]">{i + 1}</span>
              <Avatar name={p.name} size={28} />
              <span className="flex-1 text-sm font-bold">{p.name}</span>
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className={clsx(T.btn("ghost"), "h-8 w-8 rounded-lg p-0 text-sm", i === 0 ? "opacity-35" : "opacity-100")}
              >
                ↑
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === rows.length - 1}
                className={clsx(T.btn("ghost"), "h-8 w-8 rounded-lg p-0 text-sm", i === rows.length - 1 ? "opacity-35" : "opacity-100")}
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
