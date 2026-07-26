import { S } from "../../theme/styles";
import { CATEGORIES } from "@juntada/quien-soy-data";
import type { LobbyInfoProps } from "../gameTypes";

// Read-only mirror of ConfigPanel, shown to non-host players in the lobby so
// they can see what the host is configuring live.
export function LobbyInfo({ room }: LobbyInfoProps) {
  const config = room.config as { wordSource?: "categories" | "suggested"; activeCategories?: Record<string, boolean> };
  const wordSource = config.wordSource || "categories";
  const active = Object.entries(config.activeCategories || {})
    .filter(([, on]) => on)
    .map(([k]) => CATEGORIES[k])
    .filter(Boolean);

  return (
    <div style={S.card}>
      <span style={S.label}>Configuración del anfitrión</span>
      <p style={{ ...S.muted, marginBottom: active.length && wordSource === "categories" ? 10 : 0 }}>
        {wordSource === "categories" ? "Palabras de categorías predefinidas" : "Palabras sugeridas y votadas entre todos"}
      </p>
      {wordSource === "categories" &&
        (active.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {active.map(cat => (
              <span key={cat.label} style={S.pill(true)}>
                {cat.icon} {cat.label}
              </span>
            ))}
          </div>
        ) : (
          <p style={S.muted}>El anfitrión todavía no activó categorías</p>
        ))}
    </div>
  );
}
