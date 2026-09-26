import type { ReactNode } from "react";
import clsx from "clsx";
import { useResizesContentViewport } from "../hooks/useResizesContentViewport";

interface DrawingStageProps {
  /** Soy quien dibuja: el tablero cede lugar a la paleta y, en celular horizontal, la paleta va al costado. */
  drawing: boolean;
  /** Panel "Jugadores" (se muestra solo en compu, ver PlayersPanel). */
  players?: ReactNode;
  turn: ReactNode;
  board: ReactNode;
  tools?: ReactNode;
  chat: ReactNode;
  chatLabel: string;
}

// Tamaño máximo del tablero (cuadrado): el ancho lo limita la columna, el
// alto este --board-max, según formato y rol — tabla de la referencia. Las
// fórmulas de la referencia suponen su <header> de 42px; acá arriba está el
// navbar fijo (--jt-content-pad-top, 68/78px), así que a cada `calc` se le
// resta la diferencia (--rl-chrome-offset, definida en DrawingStage) para
// que tablero y paleta entren igual que en la referencia.
const CHROME_OFFSET = "[--rl-chrome-offset:calc(var(--jt-content-pad-top)-42px)]";
const BOARD_MAX_GUESSING =
  "[--board-max:56dvh] @min-[700px]:[--board-max:calc(100dvh-150px-var(--rl-chrome-offset))] @min-[1000px]:[--board-max:calc(100dvh-180px-var(--rl-chrome-offset))]";
const BOARD_MAX_DRAWING = clsx(
  "[--board-max:calc(100dvh-330px-var(--rl-chrome-offset))] @min-[700px]:[--board-max:calc(100dvh-250px-var(--rl-chrome-offset))] @min-[1000px]:[--board-max:calc(100dvh-300px-var(--rl-chrome-offset))]",
  "landscape-short:col-start-2 landscape-short:row-start-2 landscape-short:[--board-max:calc(100dvh-118px-var(--rl-chrome-offset))]",
);

/**
 * Esqueleto de la pantalla de dibujo (el `.game` de la referencia). Los
 * cortes dependen del ancho del contenedor del juego (`@container/stage`), no de
 * la pantalla:
 * - <700px: apilado — cabecera y tablero arriba, el chat ocupa el resto;
 * - 700–999px: tablero | chat (280–340px);
 * - ≥1000px: jugadores (230px) | tablero | chat (340px).
 * Celular horizontal dibujando (media query, única excepción): cabecera
 * arriba y paleta en columna al costado del tablero.
 *
 * Ocupa todo el alto disponible debajo del navbar (68px, 78px desde 900px
 * de ancho — ver .jt-content-pad-top) y todo el ancho del contenedor de la
 * app: se come el padding lateral (px-4) e inferior (pb-[60px]) que
 * AppShellLayout pone alrededor de toda pantalla de juego, para que el
 * contenedor mida lo mismo que el #app de la referencia y el chat llegue
 * hasta abajo sin que la página scrollee.
 */
export function DrawingStage({ drawing, players, turn, board, tools, chat, chatLabel }: DrawingStageProps) {
  useResizesContentViewport();
  return (
    <div
      data-rl-stage
      className={clsx(
        "@container/stage -mx-4 -mb-[60px] h-[calc(100dvh-var(--jt-content-pad-top))] font-figtree text-rl-ink",
        CHROME_OFFSET,
      )}
    >
      <div
        className={clsx(
          "flex h-full min-h-0 flex-col gap-2 px-[14px] pb-[calc(10px+env(safe-area-inset-bottom,0px))]",
          "@min-[700px]:grid @min-[700px]:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] @min-[700px]:gap-[14px]",
          "@min-[1000px]:grid-cols-[230px_minmax(0,1fr)_340px] @min-[1000px]:gap-[18px] @min-[1000px]:px-[22px] @min-[1000px]:pb-[18px]",
        )}
      >
        {players}
        <div
          className={clsx(
            "flex min-h-0 flex-none flex-col",
            drawing &&
              "landscape-short:grid landscape-short:grid-cols-[auto_minmax(0,1fr)] landscape-short:grid-rows-[auto_minmax(0,1fr)] landscape-short:gap-x-[10px]",
          )}
        >
          {turn}
          <div
            className={clsx(
              "relative mx-auto w-[min(100%,var(--board-max,56dvh))] px-1 pb-[2px] pt-[6px]",
              drawing ? BOARD_MAX_DRAWING : BOARD_MAX_GUESSING,
            )}
          >
            {board}
          </div>
          {tools}
        </div>
        <aside
          aria-label={chatLabel}
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-rl-card-border bg-rl-surface"
        >
          {chat}
        </aside>
      </div>
    </div>
  );
}
