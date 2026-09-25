import { useState, type ReactNode } from "react";
import type { RayadoSfx } from "../hooks/useRayadoSfx";
import type { PlayerRow } from "../utils/playerRows";
import { type DrawAction, type Tool } from "./Canvas";
import { Palette } from "./palette/Palette";
import { WordFlip } from "./WordFlip";
import { TimerRing } from "./TimerRing";
import { DrawingStage } from "./DrawingStage";
import { TurnBar } from "./TurnBar";
import { PaperBoard } from "./PaperBoard";
import { PlayersPanel } from "./PlayersPanel";
import { MuteButton } from "./MuteButton";

/** Todo lo que el tablero reenvía a `Canvas`/`Palette` — agrupado aparte para no dejar 6 props sueltas en {@link DrawingBoardProps} con la misma forma que ya tiene `CanvasProps` (ver Canvas.tsx). */
interface DrawingBoardCanvasProps {
  strokes: DrawAction[];
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  onStrokeChunk: (points: [number, number][], color: string, size: number, strokeId: number) => void;
  onFillAt: (x: number, y: number, color: string) => void;
  onClear: () => void;
  onUndo: () => void;
  /** Cambia cuando la hoja se vacía por pedir otra palabra (no es un "borrar todo", ver useClearFx). */
  resetKey: string;
}

/** Cabecera del turno, ya resuelta por quien llama según el rol (ver TurnBar). */
interface DrawingBoardHeader {
  drawerName: string;
  subtitle: string;
  word: ReactNode;
  /** La palabra de quien dibuja: al cambiar (pedir otra) gira en X (ver WordFlip). */
  wordKey?: string;
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
  /**
   * Si está presente, muestra el botón "Pedir otra palabra" — quien llama
   * decide cuándo corresponde (solo antes de que alguien acierte, y solo
   * una vez por turno; ver `reroll_word` en el motor online y su réplica en
   * `LocalGame.tsx`). Ausente/`undefined` oculta el botón por completo.
   */
  onReroll?: () => void;
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
  onReroll,
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
          word={<WordFlip flipKey={header.wordKey}>{header.word}</WordFlip>}
          extra={
            <>
              {interactive && onReroll && (
                // En celular horizontal queda solo el ícono (el texto sigue para lectores de pantalla).
                <button
                  type="button"
                  onClick={() => {
                    sfx.play("card");
                    onReroll();
                  }}
                  title="Pedir otra palabra"
                  className="mt-1 cursor-pointer rounded-full landscape-short:mt-0 border border-rl-card-border bg-rl-card px-[10px] py-1 text-xs font-bold"
                >
                  🔄<span className="landscape-short:sr-only"> Pedir otra palabra</span>
                </button>
              )}
              {header.notice}
            </>
          }
          timer={timerEnd ? <TimerRing timerEnd={timerEnd} total={total} correctCount={correctCount} sfx={sfx} /> : null}
          mute={<MuteButton muted={sfx.muted} onToggle={sfx.toggleMuted} />}
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
