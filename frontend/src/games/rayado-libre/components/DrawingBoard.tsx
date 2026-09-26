import { useState, type ReactNode } from "react";
import type { RayadoSfx } from "../hooks/useRayadoSfx";
import type { PlayerRow } from "../utils/playerRows";
import { type DrawAction, type Tool } from "./Canvas";
import { Palette } from "./palette/Palette";
import { TimerRing } from "./TimerRing";
import { DrawingStage } from "./DrawingStage";
import { TurnBar } from "./TurnBar";
import { PaperBoard } from "./PaperBoard";
import { PlayersPanel } from "./PlayersPanel";

/** Todo lo que el tablero reenvía a `Canvas`/`Palette` — agrupado aparte para no dejar 6 props sueltas en {@link DrawingBoardProps} con la misma forma que ya tiene `CanvasProps` (ver Canvas.tsx). */
interface DrawingBoardCanvasProps {
  strokes: DrawAction[];
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  onStrokeChunk: (points: [number, number][], color: string, size: number, strokeId: number) => void;
  onFillAt: (x: number, y: number, color: string) => void;
  onClear: () => void;
  onUndo: () => void;
  /** Cambia cuando la hoja se vacía por otra cosa que no es un "borrar todo", como el cambio de turno (ver useClearFx). */
  resetKey?: string;
}

/** Cabecera del turno, ya resuelta por quien llama según el rol (ver TurnBar). */
interface DrawingBoardHeader {
  drawerName: string;
  subtitle: string;
  word: ReactNode;
  notice?: ReactNode;
}

interface DrawingBoardProps {
  canvas: DrawingBoardCanvasProps;
  /** `true` para quien tiene el lápiz (puede dibujar y ve la paleta) — `false` para quien solo mira. */
  interactive: boolean;
  timerEnd?: number | null;
  total: number;
  /** Cuántos acertaron este turno (para detectar el salto del reloj). */
  correctCount: number;
  header: DrawingBoardHeader;
  players: PlayerRow[];
  /** Contenido de la columna del chat — el chat de adivinanzas online, o la lista de "¿quién acertó?" del modo local. */
  sideContent: ReactNode;
  sideLabel: string;
  sfx: RayadoSfx;
  /** Texto sobre la hoja vacía de quien dibuja (ver PaperBoard). */
  idleText?: string | null;
  /** Marcador que sigue el trazo remoto (solo quien mira, online). */
  remotePen?: boolean;
}

/**
 * Pantalla de dibujo completa (cabecera del turno, hoja, paleta, jugadores y
 * la columna del chat) compartida por el modo online (`DrawingPhaseScreen`)
 * y el local (`LocalDrawingScreen`), que solo difieren en cómo se decide
 * quién acertó (chat con `guess` vs. juez manual tocando nombres) y por eso
 * reciben ese pedazo como `sideContent` en vez de que este componente lo
 * conozca. El layout vive en `DrawingStage`.
 */
export function DrawingBoard({
  canvas,
  interactive,
  timerEnd,
  total,
  correctCount,
  header,
  players,
  sideContent,
  sideLabel,
  sfx,
  idleText,
  remotePen = false,
}: DrawingBoardProps) {
  const { strokes, tool, onToolChange, onStrokeChunk, onFillAt, onClear, onUndo, resetKey } = canvas;
  // "¿Borrar?" confirmados acá: la hoja tiembla aunque deshacer hubiera podido vaciarla igual (ver useClearFx).
  const [clearRequest, setClearRequest] = useState(0);
  const clearAll = () => {
    sfx.play("splat");
    setClearRequest(n => n + 1);
    onClear();
  };

  return (
    <DrawingStage
      drawing={interactive}
      players={<PlayersPanel rows={players} />}
      turn={
        <TurnBar
          drawing={interactive}
          drawerName={header.drawerName}
          subtitle={header.subtitle}
          word={header.word}
          extra={header.notice}
          timer={timerEnd ? <TimerRing timerEnd={timerEnd} total={total} correctCount={correctCount} sfx={sfx} /> : null}
        />
      }
      board={
        <PaperBoard
          strokes={strokes}
          interactive={interactive}
          tool={interactive ? tool : undefined}
          onStrokeChunk={onStrokeChunk}
          onFillAt={(x, y, color) => {
            sfx.play("fill");
            onFillAt(x, y, color);
          }}
          idleText={interactive ? idleText : null}
          remotePen={!interactive && remotePen}
          resetKey={resetKey}
          clearRequest={clearRequest}
          scribble={interactive ? sfx.scribble : undefined}
        />
      }
      tools={
        interactive && (
          <Palette tool={tool} onToolChange={onToolChange} hasDrawing={strokes.length > 0} onUndo={onUndo} onClear={clearAll} sfx={sfx} />
        )
      }
      chat={sideContent}
      chatLabel={sideLabel}
    />
  );
}
