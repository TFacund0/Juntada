import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { StartButton } from "../../components/StartButton";
import { LeaveToLobbyButton } from "../../components/LeaveToLobbyButton";
import { Board } from "./components/Board";
import { PhaseTransition } from "../../components/PhaseTransition";
import type { RoundViewProps } from "../gameTypes";

interface TatetiRoundState {
  board: (string | null)[];
  marks: Record<string, string>;
  turn: string | undefined;
  winner: string | "draw" | null;
  winningLine: number[] | null;
  forfeited?: boolean;
}

// Covers both in-progress phases ("round" while playing, "result" once a
// match ends) for the 1v1 online room. Score and the pending reset-scoreboard
// vote live in room.config (see backend/src/games/tateti/engine.js) so they
// survive across rematches, which just replace room.round.
export function RoundView({ room, me, myPlayer, send }: RoundViewProps) {
  const opponent = room.players.find(p => p.id !== me?.playerId);
  const round = room.round as TatetiRoundState | null;
  const LeaveToLobby = (
    <LeaveToLobbyButton groupCode={room.groupCode} send={send} message="Se interrumpe la partida para los dos y se pierde el marcador." />
  );
  const score: Record<string, number> = (room.config.score as Record<string, number>) || {};
  const resetVotes: string[] = (room.config.resetVotes as string[]) || [];
  const iVotedReset = !!me && resetVotes.includes(me.playerId);
  const opponentVotedReset = opponent && resetVotes.includes(opponent.id);

  const myTurn = !!me && round?.turn === me.playerId;
  const myMark = me && round?.marks?.[me.playerId];

  const mark = (index: number) => {
    if (!myTurn || round.board[index] || room.phase !== "round") return;
    send({ type: "mark", index });
  };

  const requestResetScore = () => send({ type: "reset_score_vote" });
  const cancelResetScore = () => send({ type: "cancel_score_reset" });
  const hasScoreToReset = !!(me && score[me.playerId]) || !!(opponent && score[opponent.id]) || !!(room.config.draws as number);

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

  // Nothing to reset with a 0-0-0 board, so the option doesn't even show —
  // one less thing cluttering the screen at the start of a fresh match.
  // The pending-request states below (iVotedReset/opponentVotedReset) are
  // shown regardless of hasScoreToReset since a vote already in flight
  // should always stay visible/cancelable even in that edge case.
  const ResetScoreControl = (hasScoreToReset || iVotedReset || opponentVotedReset) && (
    <div style={{ marginTop: 16 }}>
      {iVotedReset ? (
        <div style={{ textAlign: "center" }}>
          <p style={S.muted}>Pediste reiniciar el marcador — esperando que {opponent?.name} confirme</p>
          <Btn variant="ghost" onClick={cancelResetScore} style={{ fontSize: 13, marginTop: 8 }}>
            Cancelar pedido
          </Btn>
        </div>
      ) : opponentVotedReset ? (
        // Two clearly-labeled buttons side by side instead of one button
        // that opens a confirmation dialog — so it's obvious up front what
        // tapping does, instead of leaving the player unsure whether it
        // resets immediately or asks first.
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#9089c0" }}>{opponent?.name} quiere reiniciar el marcador</p>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="ghost" onClick={cancelResetScore} style={{ fontSize: 13 }}>
              Rechazar
            </Btn>
            <Btn variant="success" onClick={requestResetScore} style={{ fontSize: 13 }}>
              Aceptar
            </Btn>
          </div>
        </div>
      ) : (
        <Btn variant="ghost" onClick={requestResetScore} style={{ fontSize: 13 }}>
          Reiniciar marcador
        </Btn>
      )}
    </div>
  );

  if (room.phase === "round" && round) {
    // Keyed on the phase alone, not on round.turn — unlike a turn-based game
    // with a whole different screen per turn (Rayado Libre, Impostor), here
    // the board just stays put and a mark appears; replaying the fade-in on
    // every single move would read as flicker rather than a helpful cue.
    return (
      <PhaseTransition phaseKey="round">
        <div>
          {Scoreboard}
          <p style={{ textAlign: "center", fontSize: 14, color: "#9089c0", marginBottom: 14 }}>
            {myTurn ? <strong style={{ color: "#5DCAA5" }}>Tu turno</strong> : `Turno de ${opponent?.name}`}
          </p>
          <Board board={round.board} winningLine={round.winningLine} onCellClick={mark} disabled={!myTurn} />
          {ResetScoreControl}
          {/* Group instances use the shell's persistent "Volver al grupo" link instead.
              Available to any player, not just the host — quitting a 1v1 mid-game
              shouldn't require disconnecting and waiting out the auto-kick timeout. */}
          {LeaveToLobby}
        </div>
      </PhaseTransition>
    );
  }

  if (room.phase === "result" && round) {
    const isDraw = round.winner === "draw";
    const iWon = !!me && round.winner === me.playerId;

    return (
      <PhaseTransition phaseKey="result">
        <div>
          {Scoreboard}
          <div style={{ ...S.cardHighlight, textAlign: "center", marginBottom: 16 }}>
            <p style={S.bigReveal}>
              {/* Only the player still here ever sees a forfeited result — the
                one who left (kicked after the usual 5-minute grace period)
                is gone from room.players by the time this state exists, so
                there's no "opponent" to name and always a win from this
                viewer's side. */}
              {round.forfeited
                ? "Ganaste — tu rival abandonó la partida"
                : isDraw
                  ? "Empate"
                  : iWon
                    ? "¡Ganaste!"
                    : `Ganó ${opponent?.name}`}
            </p>
          </div>
          <Board board={round.board} winningLine={round.winningLine} disabled />

          <div style={{ marginTop: 16 }}>
            {round.forfeited ? (
              <p style={{ ...S.muted, textAlign: "center" }}>
                Volvé al lobby para esperar a alguien más — hace falta un segundo jugador para seguir.
              </p>
            ) : myPlayer?.ready ? (
              <div style={{ ...S.card, textAlign: "center" }}>
                <p style={{ color: "#5DCAA5" }}>Listo — esperando a {opponent?.name} para la revancha</p>
              </div>
            ) : (
              <StartButton onClick={() => send({ type: "player_ready" })}>Jugar de nuevo</StartButton>
            )}
          </div>
          {!round.forfeited && ResetScoreControl}
          {LeaveToLobby}
        </div>
      </PhaseTransition>
    );
  }

  return null;
}
