import { getGame } from "../../../../games/registry";
import type { GroupPublicState } from "@juntada/shared-types";

// "Partidas abiertas" section: joinable/full/in-progress branching per
// instance, plus the pending-join label and the empty state. Extracted
// verbatim from GroupScreen.tsx, which still owns `pendingJoinCode` and
// `onJoinInstance` — this component only renders derived state.
export function GroupOpenInstances({
  instances,
  pendingJoinCode,
  onJoinInstance,
}: {
  instances: GroupPublicState["instances"];
  pendingJoinCode: string | null;
  onJoinInstance: (roomCode: string) => void;
}) {
  return (
    <div className="jt-group-open-section">
      <p className="jt-group-open-title">
        Partidas abiertas <span className="jt-group-section-count">· {instances.length}</span>
      </p>
      {instances.length === 0 ? (
        <p className="jt-group-empty jt-group-open-empty">Nadie abrió una partida todavía.</p>
      ) : (
        <div className="jt-group-open-list">
          {instances.map((inst, i) => {
            const g = getGame(inst.gameType);
            const joinable = inst.phase === "lobby" && inst.playerCount < inst.maxPlayers;
            return (
              <div
                key={inst.roomCode}
                className={`jt-group-open-card jt-animate-rise ${joinable ? "jt-group-open-card--joinable" : ""}`}
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
              >
                <span className="jt-group-open-card-icon">
                  {g?.logo ? <img src={g.logo} alt={g.label} className="jt-group-open-card-logo" /> : (g?.icon ?? "🎮")}
                  {joinable && <span className="jt-group-open-card-live" aria-hidden />}
                </span>
                <div className="jt-group-row-body">
                  <p className="jt-group-row-title">{g?.label ?? inst.gameType}</p>
                  <p className="jt-group-row-meta">
                    Abrió {inst.hostName} ·{" "}
                    <strong>
                      {inst.playerCount}/{inst.maxPlayers}
                    </strong>{" "}
                    jugadores
                    {!joinable && inst.phase !== "lobby" && " · en curso"}
                    {!joinable && inst.phase === "lobby" && " · llena"}
                  </p>
                </div>
                <button
                  disabled={!joinable || pendingJoinCode === inst.roomCode}
                  onClick={() => onJoinInstance(inst.roomCode)}
                  className={`jt-group-join-btn ${joinable ? "jt-group-join-btn--active" : "jt-group-join-btn--disabled"}`}
                >
                  {pendingJoinCode === inst.roomCode ? "Uniéndose..." : joinable ? "Unirse" : "—"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
