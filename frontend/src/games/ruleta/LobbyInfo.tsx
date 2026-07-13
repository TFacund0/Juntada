import { S } from "../../theme/styles";
import type { LobbyInfoProps } from "../gameTypes";

interface Entry {
  id: string;
  name: string;
  description: string;
}

// Read-only mirror of ConfigPanel, shown to non-host players in the lobby so
// they can see what el anfitrión está cargando en vivo.
export function LobbyInfo({ room }: LobbyInfoProps) {
  const config = room.config as { entries?: Entry[]; mode?: "keep" | "eliminate" };
  const entries = config.entries || [];
  const mode = config.mode || "eliminate";

  return (
    <div style={S.card}>
      <span style={S.label}>Configuración del anfitrión</span>
      <p style={{ fontSize: 13, color: "#9089c0", marginBottom: 12 }}>
        Modo: <strong style={{ color: "#AFA9EC" }}>{mode === "eliminate" ? "Eliminación" : "Repetir"}</strong>
      </p>
      {entries.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {entries.map(e => (
            <span key={e.id} style={S.pill(true)}>
              {e.name}
            </span>
          ))}
        </div>
      ) : (
        <p style={{ ...S.muted }}>El anfitrión todavía no cargó entradas</p>
      )}
    </div>
  );
}
