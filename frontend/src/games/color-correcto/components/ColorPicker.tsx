import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { hslToHex } from "@juntada/color-correcto-scoring";

// Three-slider HSL picker (hue / saturation / brillo) — dialed.gg-style,
// instead of handing off to the OS's native <input type="color"> dialog.
// Each track's own gradient uses CSS hsl() directly so it always previews
// against the *other* two sliders' current values, e.g. dragging hue
// repaints the saturation/brightness tracks live to match.
//
// The gradient is set as the <input>'s own `background`, which only shows
// through once the browser's default track drawing is turned off — that
// needs both -webkit- and -moz- appearance resets plus emptying out each
// engine's own track/thumb pseudo-elements (a plain `appearance: none` on
// the input alone doesn't cover Firefox). No CSS pipeline in this app, so
// this is a one-off scoped <style> block instead of a stylesheet.
//
// Only `background` stays as an inline style below — it's the one truly
// dynamic value (a gradient string recomputed from the current h/s/l), which
// a static Tailwind class can't express. Everything else about the track is
// this shared class.
const SLIDER_CLASS = "cc-slider w-full h-7 cursor-pointer rounded-lg outline-none";

export interface Hsl {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

// Both LocalGame and RoundView reset the picker to the same neutral gray
// between turns/rounds — one shared value instead of two separately
// declared object literals that happen to match.
export const NEUTRAL_HSL: Hsl = { h: 0, s: 0, l: 50 };

export function hexFromHsl(value: Hsl): string {
  return hslToHex(value.h, value.s, value.l);
}

export function ColorPicker({ value, onChange }: { value: Hsl; onChange: (next: Hsl) => void }) {
  const { h, s, l } = value;
  const hex = hslToHex(h, s, l);

  return (
    <div className={T.card}>
      <style>{SLIDER_CSS}</style>

      <div className="w-full aspect-square rounded-[20px] border border-white/10 mb-3.5" style={{ background: hex }} />

      <span className={T.label}>Tono</span>
      <input
        className={clsx(SLIDER_CLASS, "mb-3.5")}
        type="range"
        min={0}
        max={360}
        value={h}
        onChange={e => onChange({ h: +e.target.value, s, l })}
        style={{ background: "linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
      />

      <span className={T.label}>Saturación</span>
      <input
        className={clsx(SLIDER_CLASS, "mb-3.5")}
        type="range"
        min={0}
        max={100}
        value={s}
        onChange={e => onChange({ h, s: +e.target.value, l })}
        style={{ background: `linear-gradient(90deg, hsl(${h},0%,${l}%), hsl(${h},100%,${l}%))` }}
      />

      <span className={T.label}>Brillo</span>
      <input
        className={SLIDER_CLASS}
        type="range"
        min={0}
        max={100}
        value={l}
        onChange={e => onChange({ h, s, l: +e.target.value })}
        style={{ background: `linear-gradient(90deg, hsl(${h},${s}%,0%), hsl(${h},${s}%,50%), hsl(${h},${s}%,100%))` }}
      />
    </div>
  );
}

const SLIDER_CSS = `
.cc-slider {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}
.cc-slider::-webkit-slider-runnable-track {
  -webkit-appearance: none;
  height: 28px;
  border-radius: 8px;
  background: transparent;
}
.cc-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 22px;
  height: 22px;
  margin-top: 3px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid rgba(0,0,0,0.35);
  box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  cursor: pointer;
}
.cc-slider::-moz-range-track {
  height: 28px;
  border-radius: 8px;
  background: transparent;
}
.cc-slider::-moz-range-progress {
  background: transparent;
}
.cc-slider::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid rgba(0,0,0,0.35);
  box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  cursor: pointer;
}
`;
