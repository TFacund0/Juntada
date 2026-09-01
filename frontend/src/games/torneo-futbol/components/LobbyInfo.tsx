import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { Avatar } from "../../../components/ui/Avatar";
import type { LobbyInfoProps } from "../../gameTypes";

// Read-only mirror of the host's "Asignar" tab (see TeamConfigPanel), shown
// to non-host players in the lobby so they can see which team they (and
// everyone else) got sorted into as the host arranges it live, instead of
// only finding out once the tournament actually starts.
export function LobbyInfo({ room }: LobbyInfoProps) {
  const config = room.config as { assignments?: Record<string, string> };
  const assignments = config.assignments ?? {};

  return (
    <div className={T.card}>
      <span className={T.label}>Equipos sorteados</span>
      {room.players.map((p, i) => {
        const team = assignments[p.id];
        return (
          <div
            key={p.id}
            className={clsx("flex items-center gap-2.5", i === 0 ? "" : "pt-2.5 mt-2.5 border-t border-[rgba(127,119,221,0.12)]")}
          >
            <Avatar name={p.name} size={28} />
            <span className="flex-1 min-w-0 truncate font-semibold">{p.name}</span>
            {team ? (
              <span className={clsx(T.pill(true), "shrink-0 max-w-[55%]")}>
                <span className="truncate">🏳️ {team}</span>
              </span>
            ) : (
              <span className="text-xs text-[#6b6490] shrink-0">Sin asignar</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
