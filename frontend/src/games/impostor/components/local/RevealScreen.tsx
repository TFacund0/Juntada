import { useState } from "react";
import { S } from "../../../../theme/styles";
import { wordHint } from "@juntada/impostor-data";
import { Btn } from "../../../../components/Btn";
import { FlipRevealCard } from "../shared/FlipRevealCard";
import { actionBtnStyle } from "../shared/actionBtnStyle";
import type { LocalPlayer, Round, Config } from "../../types/localGame";

interface RevealScreenProps {
  round: Round;
  players: LocalPlayer[];
  config: Config;
  revealIdx: number;
  setRevealIdx: (updater: (prev: number) => number) => void;
  wordVisible: boolean;
  setWordVisible: (updater: (prev: boolean) => boolean) => void;
  onDone: () => void;
}

// The pass-and-play reveal phase: the card for whoever's holding the device
// shows up front (no separate "pasale el dispositivo a X" confirm step —
// the tap-to-reveal gate on the card itself is enough of a pause for the
// handoff), then passing along — until everyone's gone, then either the
// clue-writing phase or straight to discussion (see onDone/LocalGame).
// Laid out to fill a phone screen top-to-bottom (turn label → card →
// action) instead of clumping everything in the middle with dead space
// above/below.
export function RevealScreen({ round, players, config, revealIdx, setRevealIdx, wordVisible, setWordVisible, onDone }: RevealScreenProps) {
  const alive = round.voters.map(id => players.find(p => p.id === id)).filter((p): p is LocalPlayer => Boolean(p));
  const player = alive[revealIdx];
  const isImpostor = round.impostors.includes(player.id);
  const isLast = revealIdx === alive.length - 1;
  const hint = config.hintsEnabled ? wordHint(round.categoryKey, round.word) : null;
  // Slides the current player's card out before swapping to the next one,
  // so the handoff between turns reads as a deliberate "pasando de mano en
  // mano" motion instead of an instant content swap.
  const [handingOff, setHandingOff] = useState(false);

  const advance = () => {
    if (handingOff) return;
    setHandingOff(true);
    setTimeout(() => {
      setWordVisible(() => false);
      if (isLast) onDone();
      else setRevealIdx(i => i + 1);
      setHandingOff(false);
    }, 260);
  };

  return (
    <div
      style={{
        minHeight: "calc(100dvh - 140px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{actionBtnStyle}</style>
      <style>{`
        .impostor-reveal-turn {
          animation: impostor-reveal-turn-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .impostor-reveal-turn.is-handing-off {
          animation: impostor-reveal-turn-out 0.26s cubic-bezier(0.4, 0, 1, 1) both;
        }
        @keyframes impostor-reveal-turn-in {
          from { opacity: 0; transform: translateX(36px) scale(0.97); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes impostor-reveal-turn-out {
          from { opacity: 1; transform: translateX(0) scale(1); }
          to { opacity: 0; transform: translateX(-36px) scale(0.97); }
        }
      `}</style>

      <div
        className={`impostor-reveal-turn${handingOff ? " is-handing-off" : ""}`}
        key={revealIdx}
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <div>
          <p style={{ ...S.muted, textAlign: "center", marginBottom: 10, fontSize: 12 }}>
            Jugador {revealIdx + 1} de {alive.length}
          </p>
          <div style={{ textAlign: "center", marginBottom: 14 }}>
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
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <FlipRevealCard
            visible={wordVisible}
            onToggle={() => setWordVisible(v => !v)}
            isImpostor={isImpostor}
            word={round.word}
            hint={hint}
            categoryLabel={round.categoryLabel}
            showCategory={config.showCategory}
          />
        </div>
      </div>

      <Btn onClick={advance} className="impostor-action-btn">
        {isLast ? "Todos listos, seguimos" : "Siguiente jugador"}
      </Btn>
    </div>
  );
}
