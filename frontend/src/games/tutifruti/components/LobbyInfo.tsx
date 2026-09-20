import { T } from "../../../theme/styles/classes";
import { DEFAULT_CATEGORIES } from "@juntada/tutifruti-data";
import type { LobbyInfoProps } from "../../gameTypes";

interface Category {
  id: string;
  label: string;
  icon?: string;
}

interface TutifrutiConfig {
  customCategories?: Category[];
  randomCategoryMode?: boolean;
  activeCategories?: Record<string, boolean>;
  randomCategoryCount?: number;
  rounds?: number;
  endMode?: "timer" | "basta";
  roundTime?: number;
}

// Read-only mirror of ConfigPanel, shown to non-host players in the lobby so
// they can see what the host is configuring live.
export function LobbyInfo({ room }: LobbyInfoProps) {
  const config = room.config as TutifrutiConfig;
  const customCategories: Category[] = config.customCategories || [];
  const randomMode = !!config.randomCategoryMode;
  // Custom categories go through the same activeCategories toggle as the
  // default ones (see ConfigPanel.tsx) — showing them unconditionally here
  // meant a host turning one off still left it listed as active for every
  // non-host player, indefinitely. Doesn't apply in random mode: there the
  // pool is everything (defaults + custom) regardless of that toggle, see
  // pickRoundCategories in the backend engine.
  const allActive = [...DEFAULT_CATEGORIES, ...customCategories].filter((c: Category) => config.activeCategories?.[c.id]);
  const randomCount = Math.max(1, Math.min(config.randomCategoryCount || 6, DEFAULT_CATEGORIES.length + customCategories.length));

  return (
    <div className={T.card}>
      <span className={T.label}>Configuración del anfitrión</span>
      <div className="flex gap-4 mb-3 text-[13px]">
        <span className="text-[#9089c0]">
          Rondas: <strong className="text-[#AFA9EC]">{config.rounds}</strong>
        </span>
        <span className="text-[#9089c0]">
          Fin de ronda: <strong className="text-[#AFA9EC]">{config.endMode === "basta" ? "¡Basta!" : `${config.roundTime}s`}</strong>
        </span>
      </div>
      {randomMode ? (
        <p className={T.muted}>
          Categorías aleatorias: <strong className="text-[#AFA9EC]">{randomCount}</strong> por ronda
        </p>
      ) : allActive.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {allActive.map(cat => (
            <span key={cat.id} className={T.pill(true)}>
              {cat.icon ? `${cat.icon} ` : ""}
              {cat.label}
            </span>
          ))}
        </div>
      ) : (
        <p className={T.muted}>El anfitrión todavía no activó categorías</p>
      )}
    </div>
  );
}
