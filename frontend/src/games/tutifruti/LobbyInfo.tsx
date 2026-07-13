import { S } from "../../theme/styles";
import { DEFAULT_CATEGORIES } from "@juntada/tutifruti-data";
import type { LobbyInfoProps } from "../gameTypes";

interface Category {
  id: string;
  label: string;
  icon?: string;
}

// Read-only mirror of ConfigPanel, shown to non-host players in the lobby so
// they can see what the host is configuring live.
export function LobbyInfo({ room }: LobbyInfoProps) {
  const config = room.config as any;
  const activeDefaults = (DEFAULT_CATEGORIES as Category[]).filter(c => config.activeCategories?.[c.id]);
  const customCategories: Category[] = config.customCategories || [];
  const allActive = [...activeDefaults, ...customCategories];

  return (
    <div style={S.card}>
      <span style={S.label}>Configuración del anfitrión</span>
      <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 13 }}>
        <span style={{ color: "#9089c0" }}>
          Rondas: <strong style={{ color: "#AFA9EC" }}>{config.rounds}</strong>
        </span>
        <span style={{ color: "#9089c0" }}>
          Fin de ronda: <strong style={{ color: "#AFA9EC" }}>{config.endMode === "basta" ? "¡Basta!" : `${config.roundTime}s`}</strong>
        </span>
      </div>
      {allActive.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {allActive.map(cat => (
            <span key={cat.id} style={S.pill(true)}>
              {cat.icon ? `${cat.icon} ` : ""}
              {cat.label}
            </span>
          ))}
        </div>
      ) : (
        <p style={{ ...S.muted }}>El anfitrión todavía no activó categorías</p>
      )}
    </div>
  );
}
