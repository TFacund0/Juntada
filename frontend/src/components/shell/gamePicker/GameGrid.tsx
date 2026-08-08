import type { GameDef } from "../../../games/gameTypes";
import { isUnderMaintenance, isGameAvailable } from "../../../games/maintenance";
import { PICKER_META } from "../../../games/pickerMeta";
import { S } from "../../../theme/styles";

interface GameGridProps {
  games: GameDef[];
  onSelect: (game: GameDef) => void;
  featured?: boolean;
}

export function GameGrid({ games, onSelect, featured = false }: GameGridProps) {
  return (
    <div className={featured ? "jt-game-grid jt-game-grid--featured" : "jt-game-grid"}>
      {games.map((g, i) => {
        const meta = PICKER_META[g.id];
        const dimmed = !isGameAvailable(g);
        return (
          <div
            key={g.id}
            // jt-animate-rise termina en opacity:1 (ver jt-rise en
            // homeDesign.css) — pisaría el opacity:0.55 de "dimmed" una vez
            // terminada la animación, así que esas cards quedan sin la
            // entrada animada.
            className={dimmed ? "jt-game-card" : "jt-game-card jt-animate-rise"}
            style={{
              ...S.catalogCard,
              opacity: dimmed ? 0.55 : 1,
              animationDelay: dimmed ? undefined : `${Math.min(i, 10) * 55}ms`,
            }}
            onClick={() => onSelect(g)}
          >
            <span className="jt-shine" aria-hidden />
            <div
              className={featured ? "jt-game-thumb jt-game-thumb--featured" : "jt-game-thumb"}
              style={{ ...S.catalogThumb, aspectRatio: featured ? "16 / 10" : "4 / 3", fontSize: featured ? 46 : 32, overflow: "hidden" }}
            >
              {g.logo ? (
                <img
                  src={g.logo}
                  alt={g.label}
                  className="jt-card-thumb-img"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                g.icon
              )}
              {meta && !g.comingSoon && <span className="jt-card-time-badge">{meta.minutes}</span>}
              {isUnderMaintenance(g) ? (
                <span style={{ ...S.soonBadge, color: "#EF9F27" }}>En mantenimiento</span>
              ) : (
                g.comingSoon && <span style={S.soonBadge}>Próximamente</span>
              )}
            </div>
            <div
              className={featured ? "jt-game-body jt-game-body--featured" : "jt-game-body"}
              style={{
                padding: featured ? "12px 14px 14px" : "10px 12px 12px",
                borderTop: "1px solid var(--jt-row-border, rgba(127,119,221,0.08))",
              }}
            >
              <div
                className={featured ? "jt-game-title jt-game-title--featured" : "jt-game-title"}
                style={{
                  fontWeight: 700,
                  fontSize: featured ? 16 : 14,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {g.label}
              </div>
              <p
                className={featured ? "jt-game-tagline jt-game-tagline--featured" : "jt-game-tagline"}
                style={{
                  margin: "3px 0 0",
                  fontSize: featured ? 12.5 : 11.5,
                  color: "var(--jt-muted-text, #a49dc9)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {meta?.tagline ?? g.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
