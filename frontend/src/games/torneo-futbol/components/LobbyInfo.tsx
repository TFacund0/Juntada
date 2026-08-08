import { S } from "../../../theme/styles";
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
    <div style={S.card}>
      <span style={S.label}>Equipos sorteados</span>
      {room.players.map((p, i) => {
        const team = assignments[p.id];
        return (
          <div
            key={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              paddingTop: i === 0 ? 0 : 10,
              marginTop: i === 0 ? 0 : 10,
              borderTop: i === 0 ? undefined : "1px solid rgba(127,119,221,0.12)",
            }}
          >
            <Avatar name={p.name} size={28} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
              {p.name}
            </span>
            {team ? (
              <span style={{ ...S.pill(true), flexShrink: 0, maxWidth: "55%" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🏳️ {team}</span>
              </span>
            ) : (
              <span style={{ fontSize: 12, color: "#6b6490", flexShrink: 0 }}>Sin asignar</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
