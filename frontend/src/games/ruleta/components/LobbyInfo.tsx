import { T } from "../../../theme/styles/classes";
import type { LobbyInfoProps } from "../../gameTypes";
import { getRuletaConfig } from "../utils/roomConfig";

// Read-only mirror de ConfigPanel, shown to non-host players in the lobby so
// they can see what el anfitrión está cargando en vivo.
export function LobbyInfo({ room }: LobbyInfoProps) {
  const config = getRuletaConfig(room);
  const entries = config.entries || [];
  const mode = config.mode || "eliminate";

  return (
    <div className={T.card}>
      <span className={T.label}>Configuración del anfitrión</span>
      <p className="text-[13px] text-[#9089c0] mb-3">
        Modo: <strong className="text-[#AFA9EC]">{mode === "eliminate" ? "Eliminación" : "Repetir"}</strong>
      </p>
      {entries.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {entries.map(e => (
            <span key={e.id} className={T.pill(true)}>
              {e.name}
            </span>
          ))}
        </div>
      ) : (
        <p className={T.muted}>El anfitrión todavía no cargó entradas</p>
      )}
    </div>
  );
}
