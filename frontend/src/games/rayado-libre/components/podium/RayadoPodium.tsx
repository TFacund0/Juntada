import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { GameScreenLayout } from "../../../../components/game-kit/GameScreenLayout";
import { useFxLayer } from "../../hooks/useFxLayer";
import { canAnimateNow, useMountMotion } from "../../hooks/useMountMotion";
import { podiumRevealOrder, podiumSlots, podiumTitle, rankEntries, type PodiumEntry } from "../../utils/podium";
import { PodiumColumn } from "./PodiumColumn";
import { useRayadoSfxContext } from "../../hooks/rayadoSfxContext";

// `podium` de la referencia.
const STEP_MS = 520;
const REDUCED_STEP_MS = 50;
const BAR_GROW: Keyframe[] = [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }];
const DROP: Keyframe[] = [
  { opacity: 0, transform: "translateY(-30px)" },
  { opacity: 1, transform: "none" },
];

interface RayadoPodiumProps {
  entries: readonly PodiumEntry[];
  /**
   * Festejar al ganador aunque no sea "yo" (modo local: una sola pantalla
   * para toda la mesa, no hay un "vos" que haya perdido).
   */
  celebrateAnyWinner?: boolean;
  foot: ReactNode;
}

/**
 * Podio final de Rayado Libre, online y local: barras arcoíris de 58/82/42 %
 * que crecen en orden 3.º, 2.º y 1.º (cada una con su "tac"), el avatar, el
 * nombre y los puntos cayendo sobre cada barra, y la corona sobre el
 * primero. Si gané: fanfarria, vibración y confeti; si no, un ding. Propio
 * del juego — el `PodiumBoard` de game-kit lo siguen usando los demás.
 */
export function RayadoPodium({ entries, celebrateAnyWinner = false, foot }: RayadoPodiumProps) {
  const sfx = useRayadoSfxContext();
  const slots = useMemo(() => podiumSlots(entries), [entries]);
  const winner = useMemo(() => rankEntries(entries)[0], [entries]);
  const listRef = useRef<HTMLOListElement>(null);
  const animated = useMountMotion();
  const fx = useFxLayer();

  useEffect(() => {
    if (!canAnimateNow()) return;
    const step = animated ? STEP_MS : REDUCED_STEP_MS;
    const columns = listRef.current ? Array.from(listRef.current.children) : [];
    const order = podiumRevealOrder(slots);
    const timers = order.map((index, k) => {
      if (animated) {
        const column = columns[index];
        column?.querySelector<HTMLElement>("[data-podium-bar]")?.animate(BAR_GROW, {
          duration: 600,
          delay: k * step,
          easing: "cubic-bezier(.3,1.3,.5,1)",
          fill: "backwards",
        });
        column
          ?.querySelectorAll<HTMLElement>("[data-podium-drop]")
          .forEach(el => el.animate(DROP, { duration: 400, delay: k * step + 350, easing: "ease-out", fill: "backwards" }));
      }
      return setTimeout(() => sfx.play("card"), k * step);
    });
    timers.push(
      setTimeout(() => {
        if (winner?.isMe || celebrateAnyWinner) {
          sfx.play("fanfare");
          sfx.vibrate([30, 40, 30, 40, 80]);
          if (animated) fx.confetti(70);
        } else {
          sfx.play("otherOk");
        }
      }, order.length * step),
    );
    return () => timers.forEach(clearTimeout);
    // Una sola vez, al aparecer el podio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GameScreenLayout
      center={
        <div className="mx-auto flex w-full max-w-[480px] flex-col items-center pt-4 text-center font-figtree text-rl-ink">
          <h2 className="mb-[30px] mt-0 font-marker text-[34px] font-normal">{podiumTitle(winner)}</h2>
          <ol ref={listRef} aria-label="Podio" className="m-0 flex w-full list-none items-end justify-center gap-2.5 p-0">
            {slots.map(slot => (
              <PodiumColumn key={slot.entry.id} slot={slot} />
            ))}
          </ol>
        </div>
      }
      stickyBottom={foot}
    />
  );
}
