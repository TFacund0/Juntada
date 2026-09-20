import clsx from "clsx";
import type { GameDef } from "../../../games/gameTypes";
import { isUnderMaintenance, isGameAvailable } from "../../../games/maintenance";
import { PICKER_META } from "../../../games/pickerMeta";
import { T } from "../../../theme/styles/classes";

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
            className={clsx(dimmed ? "jt-game-card" : "jt-game-card jt-animate-rise", T.catalogCard, dimmed ? "opacity-55" : "opacity-100")}
            style={dimmed ? undefined : { animationDelay: `${Math.min(i, 10) * 55}ms` }}
            onClick={() => onSelect(g)}
          >
            <span className="jt-shine" aria-hidden />
            <div
              className={clsx(
                featured ? "jt-game-thumb jt-game-thumb--featured" : "jt-game-thumb",
                T.catalogThumb,
                "overflow-hidden",
                featured ? "aspect-[16/10] text-[46px]" : "aspect-[4/3] text-[32px]",
              )}
            >
              {g.logo ? <img src={g.logo} alt={g.label} className="jt-card-thumb-img h-full w-full object-cover" /> : g.icon}
              {meta && !g.comingSoon && !isUnderMaintenance(g) && <span className="jt-card-time-badge">{meta.minutes}</span>}
              {isUnderMaintenance(g) ? (
                <span className={clsx(T.soonBadge, "text-[#EF9F27]")}>En mantenimiento</span>
              ) : (
                g.comingSoon && <span className={T.soonBadge}>Próximamente</span>
              )}
            </div>
            <div
              className={clsx(
                featured ? "jt-game-body jt-game-body--featured" : "jt-game-body",
                "border-t border-[var(--jt-row-border,rgba(127,119,221,0.08))]",
                featured ? "px-3.5 pb-3.5 pt-3" : "px-3 pb-3 pt-2.5",
              )}
            >
              <div
                className={clsx(
                  featured ? "jt-game-title jt-game-title--featured" : "jt-game-title",
                  "overflow-hidden text-ellipsis whitespace-nowrap font-bold",
                  featured ? "text-base" : "text-sm",
                )}
              >
                {g.label}
              </div>
              <p
                className={clsx(
                  featured ? "jt-game-tagline jt-game-tagline--featured" : "jt-game-tagline",
                  "m-0 mt-1 line-clamp-2 text-[var(--jt-muted-text,#a49dc9)]",
                  featured ? "text-[12.5px]" : "text-[11.5px]",
                )}
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
