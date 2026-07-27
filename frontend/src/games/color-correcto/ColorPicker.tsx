import type { CSSProperties } from "react";
import { S } from "../../theme/styles";
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
const sliderStyle: CSSProperties = { width: "100%", height: 28, cursor: "pointer", borderRadius: 8, outline: "none" };

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
    <div>
      <style>{SLIDER_CSS}</style>

      <div
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 20,
          background: hex,
          border: "1px solid rgba(255,255,255,0.1)",
          marginBottom: 14,
        }}
      />

      <span style={S.label}>Tono</span>
      <input
        className="cc-slider"
        type="range"
        min={0}
        max={360}
        value={h}
        onChange={e => onChange({ h: +e.target.value, s, l })}
        style={{
          ...sliderStyle,
          background: "linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
          marginBottom: 14,
        }}
      />

      <span style={S.label}>Saturación</span>
      <input
        className="cc-slider"
        type="range"
        min={0}
        max={100}
        value={s}
        onChange={e => onChange({ h, s: +e.target.value, l })}
        style={{
          ...sliderStyle,
          background: `linear-gradient(90deg, hsl(${h},0%,${l}%), hsl(${h},100%,${l}%))`,
          marginBottom: 14,
        }}
      />

      <span style={S.label}>Brillo</span>
      <input
        className="cc-slider"
        type="range"
        min={0}
        max={100}
        value={l}
        onChange={e => onChange({ h, s, l: +e.target.value })}
        style={{
          ...sliderStyle,
          background: `linear-gradient(90deg, hsl(${h},${s}%,0%), hsl(${h},${s}%,50%), hsl(${h},${s}%,100%))`,
        }}
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
