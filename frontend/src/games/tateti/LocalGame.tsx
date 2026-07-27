import { useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { StartButton } from "../../components/StartButton";
import { ConfirmBackButton } from "../../components/ConfirmBackButton";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Board } from "./components/Board";
import { checkWinner } from "@juntada/tateti-board";

// ═══════════════════════════════════════════════════════════════════════════════
// TA-TE-TI — un solo dispositivo, pasándoselo por turnos: cada uno toca su
// casillero cuando le toca. El marcador se mantiene entre partidas hasta que
// se reinicia a propósito.
// ═══════════════════════════════════════════════════════════════════════════════

type Winner = null | 0 | 1 | "draw";

export function LocalGame() {
  const [phase, setPhase] = useState<"setup" | "play">("setup");
  const [names, setNames] = useState(["Jugador 1", "Jugador 2"]);
  const [starterIndex, setStarterIndex] = useState(0);
  const [turnIndex, setTurnIndex] = useState(0);
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [winner, setWinner] = useState<Winner>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [score, setScore] = useState([0, 0]);
  const [draws, setDraws] = useState(0);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const marks = starterIndex === 0 ? ["X", "O"] : ["O", "X"];

  const startGame = () => {
    setStarterIndex(0);
    setTurnIndex(0);
    setBoard(Array(9).fill(null));
    setWinner(null);
    setWinningLine(null);
    setScore([0, 0]);
    setDraws(0);
    setPhase("play");
  };

  const newRound = () => {
    const nextStarter = starterIndex === 0 ? 1 : 0;
    setStarterIndex(nextStarter);
    setTurnIndex(nextStarter);
    setBoard(Array(9).fill(null));
    setWinner(null);
    setWinningLine(null);
  };

  const handleCell = (i: number) => {
    if (winner !== null || board[i]) return;
    const next = [...board];
    next[i] = marks[turnIndex];
    setBoard(next);
    const line = checkWinner(next);
    if (line) {
      setWinner(turnIndex as 0 | 1);
      setWinningLine(line);
      setScore(s => {
        const n = [...s];
        n[turnIndex]++;
        return n;
      });
    } else if (next.every(c => c !== null)) {
      setWinner("draw");
      setDraws(d => d + 1);
    } else {
      setTurnIndex(t => (t === 0 ? 1 : 0));
    }
  };

  const confirmResetScore = () => {
    setScore([0, 0]);
    setDraws(0);
    setConfirmingReset(false);
  };

  if (phase === "setup")
    return (
      <div>
        <div style={S.card}>
          <span style={S.label}>Jugador 1 (X, empieza)</span>
          <input style={{ ...S.input, marginBottom: 14 }} value={names[0]} onChange={e => setNames(n => [e.target.value, n[1]])} />
          <span style={S.label}>Jugador 2 (O)</span>
          <input style={S.input} value={names[1]} onChange={e => setNames(n => [n[0], e.target.value])} />
        </div>
        <StartButton onClick={startGame}>Empezar a jugar</StartButton>
      </div>
    );

  return (
    <div>
      <div style={{ ...S.card, display: "flex", justifyContent: "space-around", textAlign: "center" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{names[0]}</p>
          <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 800, color: "#AFA9EC" }}>{score[0]}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: "#6b6490" }}>Empates</p>
          <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 800, color: "#9089c0" }}>{draws}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{names[1]}</p>
          <p style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 800, color: "#5DCAA5" }}>{score[1]}</p>
        </div>
      </div>

      {winner === null && (
        <p style={{ textAlign: "center", fontSize: 14, color: "#9089c0", marginBottom: 14 }}>
          Turno de <strong style={{ color: turnIndex === 0 ? "#AFA9EC" : "#5DCAA5" }}>{names[turnIndex]}</strong> ({marks[turnIndex]})
        </p>
      )}

      <Board board={board} winningLine={winningLine} onCellClick={handleCell} disabled={winner !== null} />

      {winner !== null && (
        <div style={{ ...S.cardHighlight, textAlign: "center", marginTop: 16 }}>
          <p style={S.bigReveal}>{winner === "draw" ? "Empate" : `Ganó ${names[winner]}`}</p>
          <div style={{ marginTop: 8 }}>
            <StartButton onClick={newRound}>Jugar de nuevo</StartButton>
          </div>
        </div>
      )}

      {(score[0] > 0 || score[1] > 0 || draws > 0) && (
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Btn variant="ghost" onClick={() => setConfirmingReset(true)} style={{ fontSize: 13 }}>
            Reiniciar marcador
          </Btn>
        </div>
      )}
      {confirmingReset && (
        <ConfirmDialog
          title="¿Reiniciar el marcador?"
          message="Se pierden los puntos y empates acumulados."
          confirmLabel="Reiniciar"
          onConfirm={confirmResetScore}
          onCancel={() => setConfirmingReset(false)}
        />
      )}
      <ConfirmBackButton
        title="¿Volver a nombres?"
        message={
          winner === null
            ? "Hay una partida en curso — volver ahora la corta a mitad de camino. El marcador se mantiene."
            : "El marcador se mantiene si vuelven a jugar sin reiniciarlo."
        }
        confirmLabel="Volver"
        onConfirm={() => setPhase("setup")}
      >
        Volver a nombres
      </ConfirmBackButton>
    </div>
  );
}
