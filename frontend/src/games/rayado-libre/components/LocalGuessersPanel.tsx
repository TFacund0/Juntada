import clsx from "clsx";
import { Avatar } from "../../../components/ui/Avatar";
import { useAnimationGate } from "../../../components/game-kit/hooks/useAnimationGate";
import type { LocalPlayer } from "../types/localGame";
import type { RayadoSfx } from "../hooks/useRayadoSfx";
import { MuteButton } from "./MuteButton";
import { ChatHeader } from "./chat/ChatHeader";

interface LocalGuessersPanelProps {
  players: LocalPlayer[];
  drawerId: number | null;
  correctGuessers: number[];
  lastTurnPoints: Record<number, number>;
  markCorrect: (playerId: number) => void;
  sfx: RayadoSfx;
}

/**
 * Modo local (sin chat): la lista de "¿Quién acertó?" que toca quien tiene
 * el dispositivo, con la misma cabecera y el mismo estilo de panel que el
 * chat de respuestas online.
 */
export function LocalGuessersPanel({ players, drawerId, correctGuessers, lastTurnPoints, markCorrect, sfx }: LocalGuessersPanelProps) {
  const canAnimate = useAnimationGate();
  const guessers = players.filter(p => p.id !== drawerId);
  const guessed = correctGuessers.flatMap(id => {
    const p = players.find(x => x.id === id);
    return p ? [{ id: String(id), name: p.name, points: lastTurnPoints[id] ?? 0 }] : [];
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatHeader
        title="¿Quién acertó?"
        guessed={guessed}
        eligible={guessers.length}
        canAnimate={canAnimate}
        action={<MuteButton muted={sfx.muted} onToggle={sfx.toggleMuted} />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-3 pb-3 pt-2.5">
        <p className="m-0 mb-1 self-center text-center text-xs italic text-rl-muted">Tocá el nombre de quien haya adivinado en voz alta.</p>
        {guessers.map(p => {
          const already = correctGuessers.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              // Ancla de la mancha de tinta y de los puntos que vuelan al reloj (ver useGuessFx).
              data-fx-anchor={`guess-${p.id}`}
              disabled={already}
              onClick={() => markCorrect(p.id)}
              className={clsx(
                "flex items-center gap-[10px] rounded-xl border px-[10px] py-2 text-left font-bold text-rl-ink",
                already
                  ? "cursor-default border-rl-ok-line bg-rl-ok-soft"
                  : "cursor-pointer border-rl-card-border bg-rl-card hover:border-rl-accent",
              )}
            >
              <Avatar name={p.name} size={28} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {already && <span className="text-sm font-extrabold text-rl-ok-text">+{lastTurnPoints[p.id]} ✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
