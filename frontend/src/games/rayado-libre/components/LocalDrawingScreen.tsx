import { useMemo, type Dispatch, type SetStateAction } from "react";
import { PhaseTransition } from "../../../components/game-kit/PhaseTransition";
import { TURN_SECONDS, popLastDrawUnit } from "@juntada/rayado-libre-scoring";
import type { LocalPlayer } from "../types/localGame";
import type { RayadoSfx } from "../hooks/useRayadoSfx";
import { buildPlayerRows } from "../utils/playerRows";
import { letterCount } from "../utils/hintCells";
import { turnSubtitle } from "../utils/turnText";
import { type DrawAction, type Tool } from "./Canvas";
import { DrawingBoard } from "./DrawingBoard";
import { HintText } from "./HintText";
import { LocalGuessersPanel } from "./LocalGuessersPanel";

interface LocalDrawingScreenProps {
  drawer: LocalPlayer | undefined;
  timerEnd: number | null;
  /** La palabra del turno (solo para girarla al pedir otra; en pantalla se ve la pista). */
  word: string | null;
  wordHint: string | null;
  scores: Record<number, number>;
  sfx: RayadoSfx;
  strokes: DrawAction[];
  setStrokes: Dispatch<SetStateAction<DrawAction[]>>;
  tool: Tool;
  setTool: (tool: Tool) => void;
  players: LocalPlayer[];
  drawerId: number | null;
  correctGuessers: number[];
  lastTurnPoints: Record<number, number>;
  markCorrect: (playerId: number) => void;
  rerollAvailable: boolean;
  onReroll: () => void;
}

// Los ids locales son números; el panel de jugadores trabaja con strings como el online.
const toStringKeys = (record: Record<number, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [String(k), v]));

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
  word,
  wordHint,
  scores,
  sfx,
  strokes,
  setStrokes,
  tool,
  setTool,
  players,
  drawerId,
  correctGuessers,
  lastTurnPoints,
  markCorrect,
  rerollAvailable,
  onReroll,
}: LocalDrawingScreenProps) {
  const drawerName = drawer?.name ?? "";
  const hint = wordHint ?? "";
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
    <PhaseTransition phaseKey="drawing">
      <DrawingBoard
        canvas={{
          strokes,
          tool,
          onToolChange: setTool,
          onStrokeChunk: (points, color, size, strokeId) => setStrokes(s => [...s, { type: "stroke", points, color, size, strokeId }]),
          onFillAt: (x, y, color) => setStrokes(s => [...s, { type: "fill", x, y, color }]),
          onClear: () => setStrokes([]),
          onUndo: () => setStrokes(s => popLastDrawUnit(s)),
          // Pedir otra palabra vacía la hoja: eso no es un "borrar todo".
          resetKey: String(rerollAvailable),
        }}
        interactive
        timerEnd={timerEnd}
        total={TURN_SECONDS}
        correctCount={correctGuessers.length}
        header={{
          drawerName,
          subtitle: turnSubtitle({ isDrawer: false, drawerName, letters: letterCount(hint) }),
          word: <HintText hint={hint} onReveal={() => sfx.play("card")} />,
          wordKey: word ?? undefined,
        }}
        players={rows}
        sfx={sfx}
        idleText="Dibujá acá"
        onReroll={rerollAvailable ? onReroll : undefined}
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
    </PhaseTransition>
  );
}
