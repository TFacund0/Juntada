import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { CATEGORIES } from "@juntada/quien-soy-data";
import type { LobbyInfoProps } from "../../gameTypes";

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
    <div className={T.card}>
      <span className={T.label}>Configuración del anfitrión</span>
      <p className={clsx(T.muted, active.length && wordSource === "categories" ? "mb-2.5" : "mb-0")}>
        {wordSource === "categories" ? "Palabras de categorías predefinidas" : "Palabras sugeridas y votadas entre todos"}
      </p>
      {wordSource === "categories" &&
        (active.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {active.map(cat => (
              <span key={cat.label} className={T.pill(true)}>
                {cat.icon} {cat.label}
              </span>
            ))}
          </div>
        ) : (
          <p className={T.muted}>El anfitrión todavía no activó categorías</p>
        ))}
    </div>
  );
}
