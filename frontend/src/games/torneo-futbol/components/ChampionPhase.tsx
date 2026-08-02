import { S } from "../../../theme/styles";
import { StartButton } from "../../../components/setup/StartButton";
import { LeaveToLobbyButton } from "../../../components/game-kit/LeaveToLobbyButton";
import { Avatar } from "../../../components/ui/Avatar";
import type { RoundViewProps } from "../../gameTypes";
import type { Entrant, Match } from "../types";
import { ROUND_NAMES } from "../types";

// ── CHAMPION: final standings, top scorer/leakiest defense (if trackGoals),
// and the full path the bracket took to get here ──
export function ChampionPhase({
  room,
  myPlayer,
  isHost,
  send,
  rounds,
  trackGoals,
  champion,
}: Pick<RoundViewProps, "room" | "myPlayer" | "isHost" | "send"> & { rounds: Match[][]; trackGoals: boolean; champion: Entrant }) {
  const roundNames = ROUND_NAMES(rounds.length);
  const amIChampion = myPlayer && champion.id === myPlayer.id;

  const tally: Record<
    string,
    { player: { id: string; name: string }; goalsFor: number; goalsAgainst: number; played: number; won: number }
  > = {};
  // Seeded from the bracket's own entrants (m.a/m.b), not room.players — an
  // entrant snapshot never disappears even if that player later leaves the
  // room, so their already-played matches keep counting instead of quietly
  // vanishing from the goleador/valla-menos-vencida tally.
  const ensure = (p: { id: string; name: string }) => {
    if (!tally[p.id]) tally[p.id] = { player: p, goalsFor: 0, goalsAgainst: 0, played: 0, won: 0 };
  };
  rounds.forEach(round =>
    round.forEach(m => {
      if (m.goalsA == null || m.goalsB == null || !m.a || !m.b) return;
      ensure(m.a);
      ensure(m.b);
      tally[m.a.id].goalsFor += m.goalsA;
      tally[m.a.id].goalsAgainst += m.goalsB;
      tally[m.a.id].played++;
      tally[m.b.id].goalsFor += m.goalsB;
      tally[m.b.id].goalsAgainst += m.goalsA;
      tally[m.b.id].played++;
      if (m.winner) tally[m.winner.id].won++;
    }),
  );
  const s = Object.values(tally).sort((a, b) => b.goalsFor - a.goalsFor);
  const topScorer = trackGoals && s.length ? s[0] : null;
  const leakiest = trackGoals && s.length ? [...s].sort((a, b) => b.goalsAgainst - a.goalsAgainst)[0] : null;

  return (
    <div>
      <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
        <div style={{ fontSize: 56 }}>🏆</div>
        <p style={S.title}>{champion.name}</p>
        <p style={{ color: "#7F77DD", fontSize: 15, fontWeight: 700, marginTop: 4 }}>
          {amIChampion ? "¡Sos el campeón del torneo!" : "Campeón del torneo"} con {champion.team}
        </p>
      </div>

      {trackGoals && (
        <div style={S.card}>
          <span style={S.label}>Tabla de jugadores</span>
          <div
            style={{
              display: "flex",
              fontSize: 11,
              color: "#6b6490",
              padding: "0 0 8px",
              borderBottom: "1px solid rgba(127,119,221,0.15)",
            }}
          >
            <span style={{ flex: 1 }}>Jugador</span>
            <span style={{ width: 32, flexShrink: 0, textAlign: "center" }}>PJ</span>
            <span style={{ width: 32, flexShrink: 0, textAlign: "center" }}>GF</span>
            <span style={{ width: 32, flexShrink: 0, textAlign: "center" }}>GC</span>
            <span style={{ width: 40, flexShrink: 0, textAlign: "center" }}>DG</span>
          </div>
          {s.map(row => (
            <div
              key={row.player.id}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 0",
                borderBottom: "1px solid rgba(127,119,221,0.08)",
                fontSize: 13,
              }}
            >
              <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar name={row.player.name} size={24} />
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.player.name}</span>
                {row.player.id === champion.id && (
                  <span title="Campeón" style={{ flexShrink: 0 }}>
                    🏆
                  </span>
                )}
              </span>
              <span style={{ width: 32, flexShrink: 0, textAlign: "center", color: "#9089c0" }}>{row.played}</span>
              <span style={{ width: 32, flexShrink: 0, textAlign: "center", color: "#5DCAA5" }}>{row.goalsFor}</span>
              <span style={{ width: 32, flexShrink: 0, textAlign: "center", color: "#F09595" }}>{row.goalsAgainst}</span>
              <span style={{ width: 40, flexShrink: 0, textAlign: "center", fontWeight: 700 }}>
                {row.goalsFor - row.goalsAgainst >= 0 ? "+" : ""}
                {row.goalsFor - row.goalsAgainst}
              </span>
            </div>
          ))}
        </div>
      )}

      {trackGoals && (
        <div style={S.card}>
          <span style={S.label}>Estadísticas del torneo</span>
          {topScorer && topScorer.goalsFor > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>⚽</span>
              <span style={{ fontSize: 13 }}>
                Máximo goleador: <strong style={{ color: "#5DCAA5" }}>{topScorer.player.name}</strong> ({topScorer.goalsFor} goles)
              </span>
            </div>
          )}
          {leakiest && leakiest.goalsAgainst > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>🥅</span>
              <span style={{ fontSize: 13 }}>
                Valla más goleada: <strong style={{ color: "#F09595" }}>{leakiest.player.name}</strong> ({leakiest.goalsAgainst} recibidos)
              </span>
            </div>
          )}
        </div>
      )}

      <div style={S.card}>
        <span style={S.label}>Camino del torneo</span>
        {rounds.map((round, ri) => (
          <div key={ri} style={{ marginBottom: 10 }}>
            <p
              style={{
                fontSize: 11,
                color: "#7F77DD",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                margin: "0 0 6px",
              }}
            >
              {roundNames[ri]} ({ri + 1}/{rounds.length})
            </p>
            {round.map((m, mi) => (
              <div key={mi} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13 }}>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: "right",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: m.winner?.id === m.a?.id ? "#5DCAA5" : "#9089c0",
                  }}
                >
                  {m.a ? m.a.name : "—"}
                </span>
                <span style={{ flexShrink: 0, color: "#6b6490", fontSize: 12 }}>
                  {m.goalsA != null ? `${m.goalsA} - ${m.goalsB}` : "vs"}
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: m.winner?.id === m.b?.id ? "#5DCAA5" : "#9089c0",
                  }}
                >
                  {m.b ? m.b.name : "—"}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {isHost ? (
        <StartButton onClick={() => send({ type: "back_to_lobby" })}>Nuevo torneo</StartButton>
      ) : (
        <div style={{ ...S.card, textAlign: "center" }}>
          <p style={{ color: "#9089c0", fontSize: 14 }}>Esperando que el anfitrión arme otro torneo</p>
        </div>
      )}
      {/* Group instances use the shell's persistent "Volver al grupo" link instead.
        Available to any player, not just the host. */}
      <LeaveToLobbyButton groupCode={room.groupCode} send={send} />
    </div>
  );
}
