import { useState } from "react";
import clsx from "clsx";
import { T } from "../../theme/styles/classes";
import { Btn } from "../../components/ui/Btn";
import { StartButton } from "../../components/setup/StartButton";
import { ConfirmBackButton } from "../../components/game-kit/ConfirmBackButton";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
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
        <div className={T.card}>
          <span className={T.label}>Jugador 1 (X, empieza)</span>
          <input className={clsx(T.input, "mb-3.5")} value={names[0]} onChange={e => setNames(n => [e.target.value, n[1]])} />
          <span className={T.label}>Jugador 2 (O)</span>
          <input className={T.input} value={names[1]} onChange={e => setNames(n => [n[0], e.target.value])} />
        </div>
        <StartButton onClick={startGame}>Empezar a jugar</StartButton>
      </div>
    );

  return (
    <div>
      <div className={clsx(T.card, "flex justify-around text-center")}>
        <div>
          <p className="m-0 text-sm font-bold">{names[0]}</p>
          <p className="mt-0.5 text-[22px] font-extrabold text-[#AFA9EC]">{score[0]}</p>
        </div>
        <div>
          <p className="m-0 text-xs text-[#6b6490]">Empates</p>
          <p className="mt-0.5 text-[22px] font-extrabold text-[#9089c0]">{draws}</p>
        </div>
        <div>
          <p className="m-0 text-sm font-bold">{names[1]}</p>
          <p className="mt-0.5 text-[22px] font-extrabold text-[#5DCAA5]">{score[1]}</p>
        </div>
      </div>

      {winner === null && (
        <p className="mb-3.5 text-center text-sm text-[#9089c0]">
          Turno de <strong style={{ color: turnIndex === 0 ? "#AFA9EC" : "#5DCAA5" }}>{names[turnIndex]}</strong> ({marks[turnIndex]})
        </p>
      )}

      <Board board={board} winningLine={winningLine} onCellClick={handleCell} disabled={winner !== null} />

      {winner !== null && (
        <div className={clsx(T.cardHighlight, "mt-4 text-center")}>
          {/* "Empate" is short and fixed — keep the usual big size. "Ganó
              <name>" can run long (no length limit on a player's name), so
              it shrinks a step instead of looming as large as "Empate" does. */}
          <p className={clsx(T.bigReveal, winner === "draw" ? "text-[28px]" : "text-xl")}>
            {winner === "draw" ? "Empate" : `Ganó ${names[winner]}`}
          </p>
          <div className="mt-2">
            <StartButton onClick={newRound}>Jugar de nuevo</StartButton>
          </div>
        </div>
      )}

      {(score[0] > 0 || score[1] > 0 || draws > 0) && (
        <div className="mt-4 flex gap-2">
          <Btn variant="ghost" onClick={() => setConfirmingReset(true)} className="text-[13px]">
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
