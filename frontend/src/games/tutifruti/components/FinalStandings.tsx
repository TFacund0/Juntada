import { S } from "../../../theme/styles";
import { Avatar } from "../../../components/Avatar";
import { StartButton } from "../../../components/StartButton";
import { LeaveToLobbyButton } from "../../../components/LeaveToLobbyButton";
import type { RoundViewProps } from "../../gameTypes";
import type { RoomPublicState } from "@juntada/shared-types";
import type { TutifrutiRoundState } from "../types";

export function FinalStandings({
  room,
  isHost,
  send,
}: {
  room: RoomPublicState;
  round: TutifrutiRoundState;
  isHost: boolean;
  send: RoundViewProps["send"];
}) {
  const score = room.config.score as Record<string, number>;
  const standings = [...room.players].map(p => ({ ...p, score: score[p.id] || 0 })).sort((a, b) => b.score - a.score);

  return (
    <div>
      <div style={{ textAlign: "center", padding: "12px 0" }}>
        <p style={{ ...S.title, fontSize: 26, display: "block" }}>Fin del juego</p>
      </div>
      <div style={S.card}>
        <span style={S.label}>Clasificación final</span>
        {standings.map((p, i) => (
          <div
            key={p.id}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(127,119,221,0.08)" }}
          >
            <span style={{ fontWeight: 800, color: i === 0 ? "#E2C44A" : "#6b6490", width: 20 }}>{i + 1}</span>
            <Avatar name={p.name} size={30} />
            <span style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
            <span style={{ fontWeight: 800, color: "#5DCAA5" }}>{p.score} pts</span>
          </div>
        ))}
      </div>
      {isHost && <StartButton onClick={() => send({ type: "new_game" })}>Nueva partida</StartButton>}
      {!isHost && <p style={{ ...S.muted, textAlign: "center" }}>Esperando a que el anfitrión arranque una partida nueva.</p>}
      {/* Group instances use the shell's persistent "Volver al grupo" link instead.
          Available to any player, not just the host. */}
      <LeaveToLobbyButton groupCode={room.groupCode} send={send} />
    </div>
  );
}
