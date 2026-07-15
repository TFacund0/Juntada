import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { StartButton } from "../../components/StartButton";
import { BackButton } from "../../components/BackButton";
import { Board } from "./Board";
import { RevealCountdown, useRevealCountdown } from "../../components/RevealCountdown";
import type { RoundViewProps } from "../gameTypes";

// Covers both in-progress phases ("round" while playing, "result" once a
// match ends) for the 1v1 online room. Score and the pending reset-scoreboard
// vote live in room.config (see backend/src/games/tateti/engine.js) so they
// survive across rematches, which just replace room.round.
export function RoundView({ room, me, myPlayer, isHost, send }: RoundViewProps) {
  const opponent = room.players.find(p => p.id !== me?.playerId);
  const round = room.round as any;
  const score: Record<string, number> = (room.config.score as Record<string, number>) || {};
  const resetVotes: string[] = (room.config.resetVotes as string[]) || [];
  const iVotedReset = !!me && resetVotes.includes(me.playerId);
  const opponentVotedReset = opponent && resetVotes.includes(opponent.id);
  // No per-match history array here (score/draws in room.config are the
  // running tally) — their sum still ticks up exactly once per finished
  // match, which is all the countdown needs to restart on a rematch.
  const matchesPlayed = ((room.config.draws as number) || 0) + Object.values(score).reduce((a, b) => a + b, 0);
  const revealCount = useRevealCountdown(matchesPlayed);

  const myTurn = !!me && round?.turn === me.playerId;
  const myMark = me && round?.marks?.[me.playerId];

  const mark = (index: number) => {
    if (!myTurn || round.board[index] || room.phase !== "round") return;
    send({ type: "mark", index });
  };

  const requestResetScore = () => send({ type: "reset_score_vote" });

  const Scoreboard = (
    <div style={{ ...S.card, display: "flex", justifyContent: "space-around", textAlign: "center" }}>
      <div>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
          {myPlayer?.name}
          {myMark ? ` (${myMark})` : ""}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 800, color: "#AFA9EC" }}>{(me && score[me.playerId]) || 0}</p>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 12, color: "#6b6490" }}>Empates</p>
        <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 800, color: "#9089c0" }}>{(room.config.draws as number) || 0}</p>
      </div>
      <div>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
          {opponent?.name}
          {round?.marks?.[opponent?.id ?? ""] ? ` (${round.marks[opponent!.id]})` : ""}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 800, color: "#5DCAA5" }}>{opponent ? score[opponent.id] || 0 : 0}</p>
      </div>
    </div>
  );

  const ResetScoreControl = (
    <div style={{ marginTop: 16 }}>
      {iVotedReset ? (
        <p style={{ ...S.muted, textAlign: "center" }}>Pediste reiniciar el marcador — esperando que {opponent?.name} confirme</p>
      ) : opponentVotedReset ? (
        <Btn variant="danger" onClick={requestResetScore} style={{ fontSize: 13 }}>
          {opponent?.name} pidió reiniciar el marcador — confirmar
        </Btn>
      ) : (
        <Btn variant="ghost" onClick={requestResetScore} style={{ fontSize: 13 }}>
          Reiniciar marcador
        </Btn>
      )}
    </div>
  );

  if (room.phase === "round" && round) {
    return (
      <div>
        {Scoreboard}
        <p style={{ textAlign: "center", fontSize: 14, color: "#9089c0", marginBottom: 14 }}>
          {myTurn ? <strong style={{ color: "#5DCAA5" }}>Tu turno</strong> : `Turno de ${opponent?.name}`}
        </p>
        <Board board={round.board} winningLine={round.winningLine} onCellClick={mark} disabled={!myTurn} />
        {ResetScoreControl}
      </div>
    );
  }

  if (room.phase === "result" && round) {
    const isDraw = round.winner === "draw";
    const iWon = !!me && round.winner === me.playerId;

    if (revealCount > 0) return <RevealCountdown count={revealCount} label="Revelando resultado..." />;

    return (
      <div>
        {Scoreboard}
        <div style={{ ...S.cardHighlight, textAlign: "center", marginBottom: 16 }}>
          <p style={S.bigReveal}>{isDraw ? "Empate" : iWon ? "¡Ganaste!" : `Ganó ${opponent?.name}`}</p>
        </div>
        <Board board={round.board} winningLine={round.winningLine} disabled />

        <div style={{ marginTop: 16 }}>
          {myPlayer?.ready ? (
            <div style={{ ...S.card, textAlign: "center" }}>
              <p style={{ color: "#5DCAA5" }}>Listo — esperando a {opponent?.name} para la revancha</p>
            </div>
          ) : (
            <StartButton onClick={() => send({ type: "player_ready" })}>Jugar de nuevo</StartButton>
          )}
        </div>
        {ResetScoreControl}
        {/* Group instances use the shell's persistent "Volver al grupo" link instead. */}
        {isHost && room.groupCode === null && (
          <BackButton onClick={() => send({ type: "back_to_lobby" })}>Volver al lobby</BackButton>
        )}
      </div>
    );
  }

  return null;
}
