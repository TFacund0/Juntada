import { useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import { TURN_SECONDS, popLastDrawUnit } from "@juntada/rayado-libre-scoring";
import type { LocalPlayer } from "../types/localGame";
import { useLocalGuessFx } from "../hooks/useLocalGuessFx";
import { buildPlayerRows } from "../utils/playerRows";
import { letterCount } from "../utils/hintCells";
import { turnSubtitle } from "../utils/turnText";
import { toStringKeys } from "../utils/localTurn";
import { type DrawAction, type Tool } from "./Canvas";
import { DrawingBoard } from "./DrawingBoard";
import { HintText } from "./HintText";
import { LocalGuessersPanel } from "./LocalGuessersPanel";
import { useRayadoSfxContext } from "../hooks/rayadoSfxContext";

interface LocalDrawingScreenProps {
  drawer: LocalPlayer | undefined;
  timerEnd: number | null;
  wordHint: string | null;
  scores: Record<number, number>;
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

/**
 * Pantalla "drawing" del modo local: el mismo tablero y cabecera que el
 * online, con la lista de "¿quién acertó?" que maneja quien tiene el
 * dispositivo en la columna del chat (ver LocalGuessersPanel). La pantalla es compartida por todos,
 * así que la cabecera muestra la pista (la vista de quien adivina) y la
 * hoja vacía dice "Dibujá acá" sin la palabra.
 */
export function LocalDrawingScreen({
  drawer,
  timerEnd,
  wordHint,
  scores,
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
  const sfx = useRayadoSfxContext();
  const drawerName = drawer?.name ?? "";
  const hint = wordHint ?? "";
  const rootRef = useRef<HTMLDivElement>(null);
  useLocalGuessFx({ rootRef, players, correctGuessers, points: lastTurnPoints, sfx });
  const rows = useMemo(
    () =>
      buildPlayerRows({
        players: players.map(p => ({ id: String(p.id), name: p.name })),
        scores: toStringKeys(scores),
        drawerId: drawerId == null ? null : String(drawerId),
        correctGuessers: correctGuessers.map(String),
        roundPoints: toStringKeys(lastTurnPoints),
      }),
    [players, scores, drawerId, correctGuessers, lastTurnPoints],
  );

  return (
    <div ref={rootRef}>
      <DrawingBoard
        canvas={{
          strokes,
          tool,
          onToolChange: setTool,
          onStrokeChunk: (points, color, size, strokeId) => setStrokes(s => [...s, { type: "stroke", points, color, size, strokeId }]),
          onFillAt: (x, y, color) => setStrokes(s => [...s, { type: "fill", x, y, color }]),
          onClear: () => setStrokes([]),
          onUndo: () => setStrokes(s => popLastDrawUnit(s)),
        }}
        interactive
        timerEnd={timerEnd}
        total={TURN_SECONDS}
        correctCount={correctGuessers.length}
        header={{
          drawerName,
          subtitle: turnSubtitle({ isDrawer: false, drawerName, letters: letterCount(hint) }),
          word: <HintText hint={hint} onReveal={() => sfx.play("card")} />,
        }}
        players={rows}
        idleText="Dibujá acá"
        sideLabel="¿Quién acertó?"
        sideContent={
          <LocalGuessersPanel
            players={players}
            drawerId={drawerId}
            correctGuessers={correctGuessers}
            lastTurnPoints={lastTurnPoints}
            markCorrect={markCorrect}
          />
        }
      />
    </div>
  );
}
