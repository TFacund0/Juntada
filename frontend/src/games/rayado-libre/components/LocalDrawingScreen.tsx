import type { Dispatch, SetStateAction } from "react";
import { S } from "../../../theme/styles";
import { Avatar } from "../../../components/ui/Avatar";
import { Timer } from "../../../components/game-kit/Timer";
import { PhaseTransition } from "../../../components/game-kit/PhaseTransition";
import { TURN_SECONDS, popLastDrawUnit } from "@juntada/rayado-libre-scoring";
import type { LocalPlayer } from "../types/localGame";
import { Canvas, type DrawAction, type Tool } from "./Canvas";
import { Toolbar } from "./Toolbar";
import { WordHintCard } from "./WordHintCard";

interface LocalDrawingScreenProps {
  turnNumber: number;
  totalTurns: number;
  drawer: LocalPlayer | undefined;
  timerEnd: number | null;
  wordHint: string | null;
  strokes: DrawAction[];
  setStrokes: Dispatch<SetStateAction<DrawAction[]>>;
  tool: Tool;
  setTool: (tool: Tool) => void;
  players: LocalPlayer[];
  drawerId: number | null;
  correctGuessers: number[];
  lastTurnPoints: Record<number, number>;
  markCorrect: (playerId: number) => void;
}

/** Pantalla "drawing" del modo local: el tablero a la vista de todos y la lista de "¿quién acertó?" que maneja quien tiene el dispositivo. */
export function LocalDrawingScreen({
  turnNumber,
  totalTurns,
  drawer,
  timerEnd,
  wordHint,
  strokes,
  setStrokes,
  tool,
  setTool,
  players,
  drawerId,
  correctGuessers,
  lastTurnPoints,
  markCorrect,
}: LocalDrawingScreenProps) {
  return (
    <PhaseTransition phaseKey="drawing">
      <div>
        <p style={{ textAlign: "center", fontSize: 13, color: "#9089c0", marginBottom: 4 }}>
          Turno {turnNumber}/{totalTurns} — dibuja {drawer?.name}
        </p>
        {timerEnd && <Timer timerEnd={timerEnd} total={TURN_SECONDS} label="Tiempo para dibujar" />}

        {wordHint != null && <WordHintCard hint={wordHint} />}

        <Canvas
          strokes={strokes}
          interactive
          tool={tool}
          onStrokeChunk={(points, color, size, strokeId) => setStrokes(s => [...s, { type: "stroke", points, color, size, strokeId }])}
          onFillAt={(x, y, color) => setStrokes(s => [...s, { type: "fill", x, y, color }])}
        />
        <Toolbar tool={tool} onChange={setTool} onClear={() => setStrokes([])} onUndo={() => setStrokes(s => popLastDrawUnit(s))} />

        <div style={{ ...S.card, marginTop: 16 }}>
          <span style={S.label}>¿Quién acertó?</span>
          <p style={{ ...S.muted, margin: "0 0 10px" }}>Tocá el nombre de quien haya adivinado en voz alta.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {players
              .filter(p => p.id !== drawerId)
              .map(p => {
                const already = correctGuessers.includes(p.id);
                return (
                  <button
                    key={p.id}
                    disabled={already}
                    onClick={() => markCorrect(p.id)}
                    style={{
                      ...S.btn(already ? "ghost" : "success"),
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      opacity: already ? 0.6 : 1,
                    }}
                  >
                    <Avatar name={p.name} size={28} />
                    <span style={{ flex: 1, textAlign: "left", fontWeight: 700 }}>{p.name}</span>
                    {already && <span style={{ fontSize: 13 }}>+{lastTurnPoints[p.id]} pts ✓</span>}
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    </PhaseTransition>
  );
}
