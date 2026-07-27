import { S } from "../../theme/styles";
import { Timer } from "../../components/Timer";
import { SHOW_SECONDS } from "@juntada/color-correcto-scoring";

// The "show" phase screen — target color memorized before it's hidden.
// Identical between LocalGame and RoundView; only the timer's end timestamp
// and (locally) the target color source differ.
export function TargetSwatch({ target, timerEnd }: { target: string; timerEnd: number | null }) {
  return (
    <div>
      {timerEnd != null && <Timer timerEnd={timerEnd} total={SHOW_SECONDS} label="Se oculta en" />}
      <p style={{ ...S.muted, textAlign: "center", marginBottom: 10 }}>Memorizá este color…</p>
      <div
        data-testid="target-swatch"
        style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 20, background: target, border: "1px solid rgba(255,255,255,0.1)" }}
      />
    </div>
  );
}
