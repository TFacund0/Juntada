import { useState } from "react";
import { S } from "../../../../theme/styles";
import { Btn } from "../../../../components/Btn";
import { TurnCircle } from "../../../../components/TurnCircle";
import { CluesReview } from "../shared/CluesReview";
import { actionBtnStyle } from "../shared/actionBtnStyle";
import type { LocalPlayer, Round } from "../../types/localGame";

interface ClueEntryScreenProps {
  round: Round;
  players: LocalPlayer[];
  clues: Record<number, string>;
  clueIdx: number;
  setClueIdx: (updater: (prev: number) => number) => void;
  clueInput: string;
  setClueInput: (value: string) => void;
  setClues: (updater: (prev: Record<number, string>) => Record<number, string>) => void;
  onDone: () => void;
}

// A phase of its own, between reveal and discussion — only when "Pistas
// escritas" is on. Everyone already knows their word/role by this point (see
// RevealScreen), so this is purely "now type what you're about to say out
// loud" one at a time, same turn-order-with-a-ring visual as online's
// RoundPhaseScreen (TurnCircle) instead of reinventing a plain list.
export function ClueEntryScreen({
  round,
  players,
  clues,
  clueIdx,
  setClueIdx,
  clueInput,
  setClueInput,
  setClues,
  onDone,
}: ClueEntryScreenProps) {
  const order = round.voters;
  const currentId = order[clueIdx];
  const player = players.find(p => p.id === currentId);
  const isLast = clueIdx === order.length - 1;
  // Same "slide the current turn out, next one in" handoff beat as
  // RevealScreen's advance — keeps the two turn-based phases feeling
  // consistent instead of one snapping instantly and the other not.
  const [handingOff, setHandingOff] = useState(false);

  const submit = () => {
    if (!clueInput.trim() || handingOff || !player) return;
    setClues(c => ({ ...c, [player.id]: clueInput.trim() }));
    setHandingOff(true);
    setTimeout(() => {
      setClueInput("");
      if (isLast) onDone();
      else setClueIdx(i => i + 1);
      setHandingOff(false);
    }, 260);
  };

  if (!player) return null;

  return (
    <div style={{ minHeight: "calc(100dvh - 140px)", display: "flex", flexDirection: "column" }}>
      <style>{actionBtnStyle}</style>
      <style>{`
        .impostor-clue-turn {
          animation: impostor-clue-turn-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .impostor-clue-turn.is-handing-off {
          animation: impostor-clue-turn-out 0.26s cubic-bezier(0.4, 0, 1, 1) both;
        }
        @keyframes impostor-clue-turn-in {
          from { opacity: 0; transform: translateX(36px) scale(0.97); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes impostor-clue-turn-out {
          from { opacity: 1; transform: translateX(0) scale(1); }
          to { opacity: 0; transform: translateX(-36px) scale(0.97); }
        }
      `}</style>

      <div
        className={`impostor-clue-turn${handingOff ? " is-handing-off" : ""}`}
        key={clueIdx}
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <p style={{ ...S.muted, textAlign: "center", marginBottom: 10, fontSize: 12 }}>
          Jugador {clueIdx + 1} de {order.length}
        </p>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <p
            style={{
              margin: "0 0 4px",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--jt-accent, #7F77DD)",
            }}
          >
            Turno de
          </p>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 24 }}>{player.name}</p>
        </div>

        <TurnCircle
          turnOrder={order.map(String)}
          turnIndex={clueIdx}
          players={players.map(p => ({ id: String(p.id), name: p.name }))}
          meId={undefined}
        />

        <CluesReview clues={clues} players={players} label="Palabras de los jugadores" maxHeight={140} />
      </div>

      <div style={S.card}>
        <span style={S.label}>Tu palabra</span>
        <input
          style={S.input}
          placeholder="Escribí tu palabra antes de pasar el dispositivo..."
          value={clueInput}
          onChange={e => setClueInput(e.target.value)}
          autoFocus
        />
      </div>

      <Btn onClick={submit} disabled={!clueInput.trim()} className="impostor-action-btn">
        {isLast ? "Todos listos, a discutir" : "Siguiente jugador"}
      </Btn>
    </div>
  );
}
