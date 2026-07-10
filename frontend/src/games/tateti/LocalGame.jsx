import { useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { Board } from "./Board";
import { checkWinner } from "./boardLogic";

// ═══════════════════════════════════════════════════════════════════════════════
// TA-TE-TI — un solo dispositivo, pasándoselo por turnos: cada uno toca su
// casillero cuando le toca. El marcador se mantiene entre partidas hasta que
// se reinicia a propósito.
// ═══════════════════════════════════════════════════════════════════════════════

export function LocalGame() {
  const [phase, setPhase] = useState("setup"); // setup | play
  const [names, setNames] = useState(["Jugador 1", "Jugador 2"]);
  const [starterIndex, setStarterIndex] = useState(0);
  const [turnIndex, setTurnIndex] = useState(0);
  const [board, setBoard] = useState(Array(9).fill(null));
  const [winner, setWinner] = useState(null); // null | 0 | 1 | "draw"
  const [winningLine, setWinningLine] = useState(null);
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

  const handleCell = (i) => {
    if (winner !== null || board[i]) return;
    const next = [...board];
    next[i] = marks[turnIndex];
    setBoard(next);
    const line = checkWinner(next);
    if (line) {
      setWinner(turnIndex);
      setWinningLine(line);
      setScore(s => { const n = [...s]; n[turnIndex]++; return n; });
    } else if (next.every(c => c !== null)) {
      setWinner("draw");
      setDraws(d => d + 1);
    } else {
      setTurnIndex(t => t === 0 ? 1 : 0);
    }
  };

  const requestResetScore = () => {
    if (!confirmingReset) { setConfirmingReset(true); return; }
    setScore([0, 0]);
    setDraws(0);
    setConfirmingReset(false);
  };

  if (phase === "setup") return (
    <div>
      <div style={S.card}>
        <span style={S.label}>Jugador 1</span>
        <input style={{ ...S.input, marginBottom: 14 }} value={names[0]} onChange={e => setNames(n => [e.target.value, n[1]])} />
        <span style={S.label}>Jugador 2</span>
        <input style={S.input} value={names[1]} onChange={e => setNames(n => [n[0], e.target.value])} />
      </div>
      <Btn onClick={startGame}>Empezar a jugar</Btn>
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
          <Btn variant="success" onClick={newRound} style={{ marginTop: 8 }}>Jugar de nuevo</Btn>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Btn variant={confirmingReset ? "danger" : "default"} onClick={requestResetScore} style={{ fontSize: 13 }}>
          {confirmingReset ? "¿Seguro? Tocá de nuevo para confirmar" : "Reiniciar marcador"}
        </Btn>
      </div>
      <Btn variant="default" onClick={() => setPhase("setup")} style={{ marginTop: 10 }}>Volver a nombres</Btn>
    </div>
  );
}
