import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { Timer } from "../../../components/game-kit/Timer";
import { SHOW_SECONDS } from "@juntada/color-correcto-scoring";

// The "show" phase screen — target color memorized before it's hidden.
// Identical between LocalGame and RoundView; only the timer's end timestamp
// and (locally) the target color source differ.
export function TargetSwatch({ target, timerEnd }: { target: string; timerEnd: number | null }) {
  return (
    <div className={T.card}>
      {timerEnd != null && <Timer timerEnd={timerEnd} total={SHOW_SECONDS} label="Se oculta en" />}
      <p className={clsx(T.muted, "text-center mb-2.5")}>Memorizá este color…</p>
      <div
        data-testid="target-swatch"
        className="w-full aspect-square rounded-[20px] border border-white/10"
        style={{ background: target }}
      />
    </div>
  );
}
