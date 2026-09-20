import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { Canvas, type DrawAction, type Tool } from "./Canvas";
import { Toolbar } from "./Toolbar";
import { CircularTimer } from "./CircularTimer";

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

interface DrawingBoardProps {
  canvas: DrawingBoardCanvasProps;
  /** `true` para quien tiene el lápiz (puede tocar/arrastrar el canvas y usa la toolbar) — `false` para quien solo mira. */
  interactive: boolean;
  timerEnd?: number | null;
  total: number;
  /** Palabra o pista a mostrar en el centro del header del tablero — ya resuelta por quien llama (el modo online muestra la propia palabra u una pista según el rol, el local siempre la pista). */
  wordSlot?: ReactNode;
  /** Contenido de la columna lateral (mobile: debajo del tablero; desktop: al costado) — el chat de adivinanzas online, o la lista de "¿quién acertó?" del modo local. */
  sideContent: ReactNode;
  /**
   * Si está presente, muestra el botón "Pedir otra palabra" — quien llama
   * decide cuándo corresponde (solo antes de que alguien acierte, y solo
   * una vez por turno; ver `reroll_word` en el motor online y su réplica en
   * `LocalGame.tsx`). Ausente/`undefined` oculta el botón por completo.
   */
  onReroll?: () => void;
}

/**
 * Tablero de dibujo completo: header (timer circular + palabra/pista),
 * canvas, y toolbar — compartido por el modo online (`DrawingPhaseScreen`) y
 * el modo local (`LocalDrawingScreen`), que solo difieren en cómo se decide
 * quién acertó (chat con `guess` vs. juez manual tocando nombres) y por eso
 * reciben ese pedazo como `sideContent` en vez de que este componente lo
 * conozca. Mismo grid responsivo en los dos: apilado en mobile (con la
 * toolbar en una hoja deslizable), dos columnas a partir de 1024px.
 */
export function DrawingBoard({ canvas, interactive, timerEnd, total, wordSlot, sideContent, onReroll }: DrawingBoardProps) {
  const { strokes, tool, onToolChange, onStrokeChunk, onFillAt, onClear, onUndo } = canvas;
  // Solo aplica en mobile — en desktop la toolbar queda siempre visible en la
  // columna lateral, no hace falta abrirla/cerrarla.
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const hasHeader = !!timerEnd || !!wordSlot;

  return (
    <>
      {/* Apilado en mobile; a partir de 1024px el canvas gana el ancho
          sobrante y la toolbar+lateral pasan a una columna fija. */}
      <style>{`
        .rl-drawing-grid { display: flex; flex-direction: column; gap: 12px; flex: 1 1 auto; min-height: 0; }
        .rl-board { display: flex; flex-direction: column; }
        /* En mobile el tablero y el lateral suben un poco, más cerca del turno
           de arriba en vez de dejar tanto aire antes de llegar al canvas. */
        @media (max-width: 1023px) {
          .rl-drawing-grid { gap: 8px; margin-top: -8px; }
        }
        .rl-board-header {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 10px;
          padding-bottom: 8px;
          margin-bottom: 8px;
          border-bottom: 1px solid var(--jt-card-border, rgba(127,119,221,0.18));
        }
        .rl-board-header-side { display: flex; align-items: center; min-width: 0; }
        .rl-board-header-side--start { justify-content: flex-start; }
        .rl-board-header-side--end { justify-content: flex-end; }
        .rl-board-word { text-align: center; }
        .rl-toolbar-toggle {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          font-size: 19px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--jt-accent, #7F77DD);
          color: #fff;
          box-shadow: 0 6px 16px -6px rgba(0,0,0,0.5);
          flex-shrink: 0;
        }
        .rl-right-col { display: flex; flex-direction: column; gap: 12px; }
        .rl-toolbar-desktop { display: none; }
        .rl-toolbar-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          z-index: 4;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
        }
        .rl-toolbar-backdrop.rl-toolbar-backdrop--open { opacity: 1; pointer-events: auto; }
        .rl-toolbar-sheet {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 5;
          background: var(--jt-bg, #0f0c1d);
          border-top: 1px solid var(--jt-card-border, rgba(127,119,221,0.25));
          border-radius: 16px 16px 0 0;
          padding: 14px 14px 20px;
          transform: translateY(100%);
          transition: transform 0.25s cubic-bezier(0.32,0.72,0,1);
        }
        .rl-toolbar-sheet.rl-toolbar-sheet--open { transform: translateY(0); }
        @media (prefers-reduced-motion: reduce) {
          .rl-toolbar-sheet { transition: none; }
        }
        @media (min-width: 1024px) {
          .rl-drawing-grid { display: grid; grid-template-columns: 1fr 320px; align-items: start; }
          .rl-toolbar-toggle, .rl-toolbar-backdrop, .rl-toolbar-sheet { display: none; }
          .rl-toolbar-desktop { display: block; }
        }
      `}</style>
      <div className="rl-drawing-grid">
        <div className={clsx("rl-board", T.card)}>
          {(hasHeader || interactive) && (
            <div className="rl-board-header">
              <div className="rl-board-header-side rl-board-header-side--start">
                {timerEnd && <CircularTimer timerEnd={timerEnd} total={total} />}
              </div>
              {/* Siempre montado (aunque vacío) — con el grid de 3
                  columnas, si esta celda del medio no existe en el DOM,
                  el botón de la derecha cae en la columna del medio en
                  vez de quedar pegado al borde derecho. */}
              <div className="rl-board-word">{wordSlot}</div>
              <div className="rl-board-header-side rl-board-header-side--end">
                {/* Solo mobile (ver media query >=1024px) — en desktop la
                    toolbar ya queda visible en la columna lateral. */}
                {interactive && (
                  <button
                    className="rl-toolbar-toggle"
                    aria-label={toolbarOpen ? "Cerrar herramientas" : "Abrir herramientas de dibujo"}
                    onClick={() => setToolbarOpen(o => !o)}
                  >
                    {toolbarOpen ? "✕" : "🎨"}
                  </button>
                )}
              </div>
            </div>
          )}
          {interactive && onReroll && (
            <button onClick={onReroll} className={clsx(T.btn("ghost"), "mb-2 p-2 text-xs")}>
              🔄 Pedir otra palabra
            </button>
          )}
          <Canvas
            strokes={strokes}
            interactive={interactive}
            tool={interactive ? tool : undefined}
            onStrokeChunk={onStrokeChunk}
            onFillAt={onFillAt}
          />
          {/* La hoja de herramientas y su fondo van por portal a
              document.body — PhaseTransition anima con `transform` al
              montar la pantalla, y un ancestro con `transform` atrapa
              cualquier `position: fixed` de estos elementos, pegándolos
              al wrapper animado (y tapando el canvas) en vez de al
              viewport. Mismo motivo que StickyActionBar. */}
          {interactive &&
            createPortal(
              <>
                <div
                  className={`rl-toolbar-backdrop${toolbarOpen ? " rl-toolbar-backdrop--open" : ""}`}
                  onClick={() => setToolbarOpen(false)}
                />
                <div className={`rl-toolbar-sheet${toolbarOpen ? " rl-toolbar-sheet--open" : ""}`}>
                  <Toolbar bare tool={tool} onChange={onToolChange} onClear={onClear} onUndo={onUndo} />
                </div>
              </>,
              document.body,
            )}
        </div>
        <div className="rl-right-col">
          {interactive && (
            <div className={clsx("rl-toolbar-desktop", T.card)}>
              <Toolbar tool={tool} onChange={onToolChange} onClear={onClear} onUndo={onUndo} />
            </div>
          )}
          {sideContent}
        </div>
      </div>
    </>
  );
}
