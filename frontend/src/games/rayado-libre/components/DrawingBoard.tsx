import type { ReactNode } from "react";
import type { RayadoSfx } from "../hooks/useRayadoSfx";
import type { PlayerRow } from "../utils/playerRows";
import { type DrawAction, type Tool } from "./Canvas";
import { Toolbar } from "./Toolbar";
import { TimerRing } from "./TimerRing";
import { DrawingStage } from "./DrawingStage";
import { TurnBar } from "./TurnBar";
import { PaperBoard } from "./PaperBoard";
import { PlayersPanel } from "./PlayersPanel";
import { MuteButton } from "./MuteButton";

/** Todo lo que el tablero reenvía a `Canvas`/`Toolbar` sin transformarlo — agrupado aparte para no dejar 6 props sueltas en {@link DrawingBoardProps} con la misma forma que ya tiene `CanvasProps` (ver Canvas.tsx). */
interface DrawingBoardCanvasProps {
  strokes: DrawAction[];
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  onStrokeChunk: (points: [number, number][], color: string, size: number, strokeId: number) => void;
  onFillAt: (x: number, y: number, color: string) => void;
  onClear: () => void;
  onUndo: () => void;
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
  const { strokes, tool, onToolChange, onStrokeChunk, onFillAt, onClear, onUndo } = canvas;

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
          extra={
            <>
              {interactive && onReroll && (
                // En celular horizontal queda solo el ícono (el texto sigue para lectores de pantalla).
                <button
                  type="button"
                  onClick={onReroll}
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
          onFillAt={onFillAt}
          idleText={interactive ? idleText : null}
          remotePen={!interactive && remotePen}
        />
      }
      tools={
        interactive && (
          // Lugar de la paleta: debajo del tablero, o en columna a su costado en
          // celular horizontal. La paleta rediseñada llega en la fase 2.
          <div className="mt-[10px] flex flex-col gap-2 rounded-[18px] border border-rl-card-border bg-rl-surface px-[10px] pb-[9px] pt-[10px] @min-[1000px]:mx-auto @min-[1000px]:mt-3 @min-[1000px]:w-[min(100%,calc(100dvh-300px))] short-screen:gap-[6px] short-screen:p-2 landscape-short:col-start-1 landscape-short:row-start-2 landscape-short:m-0 landscape-short:max-h-full landscape-short:w-[150px] landscape-short:self-start landscape-short:overflow-y-auto landscape-short:p-[6px]">
            <Toolbar bare tool={tool} onChange={onToolChange} onClear={onClear} onUndo={onUndo} />
          </div>
        )
      }
      chat={sideContent}
      chatLabel={sideLabel}
    />
  );
}
