import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { StartButton } from "../../../components/setup/StartButton";
import { LeaveToLobbyButton } from "../../../components/game-kit/LeaveToLobbyButton";
import { Avatar } from "../../../components/ui/Avatar";
import type { RoundViewProps } from "../../gameTypes";
import type { Entrant, Match } from "../types/roundView";
import { ROUND_NAMES } from "../types/roundView";

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
      <div className="text-center p-[10px_0_20px]">
        <div className="text-[56px]">🏆</div>
        <p className={T.title}>{champion.name}</p>
        <p className="mt-1 text-[15px] font-bold text-[#7F77DD]">
          {amIChampion ? "¡Sos el campeón del torneo!" : "Campeón del torneo"} con {champion.team}
        </p>
      </div>

      {trackGoals && (
        <div className={T.card}>
          <span className={T.label}>Tabla de jugadores</span>
          <div className={T.statTableHeader}>
            <span className="flex-1">Jugador</span>
            <span className={T.statTableCol}>PJ</span>
            <span className={T.statTableCol}>GF</span>
            <span className={T.statTableCol}>GC</span>
            <span className={T.statTableColWide(false)}>DG</span>
          </div>
          {s.map(row => (
            <div key={row.player.id} className={T.statTableRow}>
              <span className="flex flex-1 min-w-0 items-center gap-2">
                <Avatar name={row.player.name} size={24} />
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{row.player.name}</span>
                {row.player.id === champion.id && (
                  <span title="Campeón" className="shrink-0">
                    🏆
                  </span>
                )}
              </span>
              <span className={clsx(T.statTableCol, "text-[#9089c0]")}>{row.played}</span>
              <span className={clsx(T.statTableCol, "text-[#5DCAA5]")}>{row.goalsFor}</span>
              <span className={clsx(T.statTableCol, "text-[#F09595]")}>{row.goalsAgainst}</span>
              <span className={T.statTableColWide(true)}>
                {row.goalsFor - row.goalsAgainst >= 0 ? "+" : ""}
                {row.goalsFor - row.goalsAgainst}
              </span>
            </div>
          ))}
        </div>
      )}

      {trackGoals && (
        <div className={T.card}>
          <span className={T.label}>Estadísticas del torneo</span>
          {topScorer && topScorer.goalsFor > 0 && (
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="text-xl">⚽</span>
              <span className="text-[13px]">
                Máximo goleador: <strong className="text-[#5DCAA5]">{topScorer.player.name}</strong> ({topScorer.goalsFor} goles)
              </span>
            </div>
          )}
          {leakiest && leakiest.goalsAgainst > 0 && (
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🥅</span>
              <span className="text-[13px]">
                Valla más goleada: <strong className="text-[#F09595]">{leakiest.player.name}</strong> ({leakiest.goalsAgainst} recibidos)
              </span>
            </div>
          )}
        </div>
      )}

      <div className={T.card}>
        <span className={T.label}>Camino del torneo</span>
        {rounds.map((round, ri) => (
          <div key={ri} className="mb-2.5">
            <p className={T.pathRoundLabel}>
              {roundNames[ri]} ({ri + 1}/{rounds.length})
            </p>
            {round.map((m, mi) => (
              <div key={mi} className={T.pathMatchRow}>
                <span className={clsx(T.pathEntrantName(m.winner?.id === m.a?.id), "text-right")}>{m.a ? m.a.name : "—"}</span>
                <span className="shrink-0 text-xs text-[#6b6490]">{m.goalsA != null ? `${m.goalsA} - ${m.goalsB}` : "vs"}</span>
                <span className={T.pathEntrantName(m.winner?.id === m.b?.id)}>{m.b ? m.b.name : "—"}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {isHost ? (
        <StartButton onClick={() => send({ type: "back_to_lobby" })}>Nuevo torneo</StartButton>
      ) : (
        <div className={clsx(T.card, "text-center")}>
          <p className="text-sm text-[#9089c0]">Esperando que el anfitrión arme otro torneo</p>
        </div>
      )}
      {/* Group instances use the shell's persistent "Volver al grupo" link instead.
        Available to any player, not just the host. */}
      <LeaveToLobbyButton groupCode={room.groupCode} send={send} />
    </div>
  );
}
