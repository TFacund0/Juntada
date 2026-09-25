// Sonidos de Rayado Libre, sintetizados con Web Audio (sin archivos),
// portados de `sfx` en docs/referencias/rayado-libre-referencia-v2.html.
// Cada uno solo agenda nodos en el contexto que recibe, a partir de `t` —
// sin estado propio: useRayadoSfx es dueño del contexto, del silencio y del
// manejo de errores. El garabato continuo de dibujo (scribble) tiene estado
// y llega con la paleta, en la fase 2.

export type RayadoSfxName =
  | "msg"
  | "mine"
  | "close"
  | "otherOk"
  | "youOk"
  | "splat"
  | "jump"
  | "beat"
  | "card"
  | "click"
  | "cap"
  | "fill"
  | "count"
  | "end"
  | "fanfare";

type Synth = (ac: AudioContext, t: number) => void;

// Ataque corto, caída exponencial — la forma que usan casi todos.
function envelope(gain: GainNode, t: number, peak: number, seconds: number): void {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
}

function noiseBuffer(ac: AudioContext, seconds: number): AudioBuffer {
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function tone(ac: AudioContext, t: number, freq: number, seconds: number, type: OscillatorType, peak: number): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  envelope(gain, t, peak, seconds);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + seconds + 0.02);
}

function noiseBurst(ac: AudioContext, t: number, freq: number, seconds: number, peak: number, type: BiquadFilterType = "bandpass"): void {
  const source = ac.createBufferSource();
  source.buffer = noiseBuffer(ac, seconds);
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const gain = ac.createGain();
  envelope(gain, t, peak, seconds);
  source.connect(filter).connect(gain).connect(ac.destination);
  source.start(t);
}

// Barrido de frecuencia (from → to en `glide` segundos), usado por "salto" y "balde".
function sweep(
  ac: AudioContext,
  t: number,
  type: OscillatorType,
  from: number,
  to: number,
  glide: number,
  peak: number,
  seconds: number,
  stopAfter: number,
): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + glide);
  envelope(gain, t, peak, seconds);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + stopAfter);
}

const arpeggio = (ac: AudioContext, t: number, notes: number[], step: number, seconds: number) =>
  notes.forEach((f, i) => tone(ac, t + i * step, f, seconds, "triangle", 0.1));

const SYNTHS: Record<RayadoSfxName, Synth> = {
  msg: (ac, t) => tone(ac, t, 760, 0.05, "sine", 0.05),
  mine: (ac, t) => tone(ac, t, 980, 0.04, "sine", 0.04),
  close: (ac, t) => {
    tone(ac, t, 520, 0.08, "triangle", 0.08);
    tone(ac, t + 0.08, 560, 0.08, "triangle", 0.06);
  },
  otherOk: (ac, t) => {
    tone(ac, t, 660, 0.1, "sine", 0.1);
    tone(ac, t + 0.08, 880, 0.16, "sine", 0.1);
  },
  youOk: (ac, t) => [523, 659, 784, 1047].forEach((f, i) => tone(ac, t + i * 0.07, f, 0.28, "triangle", 0.11)),
  splat: (ac, t) => noiseBurst(ac, t, 900, 0.25, 0.5, "lowpass"),
  // Barrido descendente cuando el reloj salta a una zona menor.
  jump: (ac, t) => sweep(ac, t, "sawtooth", 900, 180, 0.5, 0.06, 0.55, 0.6),
  // Latido grave en los últimos 10 segundos.
  beat: (ac, t) => tone(ac, t, 70, 0.16, "sine", 0.4),
  card: (ac, t) => noiseBurst(ac, t, 2000, 0.08, 0.15, "highpass"),
  click: (ac, t) => noiseBurst(ac, t, 3000, 0.03, 0.12, "highpass"),
  cap: (ac, t) => {
    tone(ac, t, 1400, 0.03, "triangle", 0.06);
    noiseBurst(ac, t, 2500, 0.02, 0.08, "highpass");
  },
  fill: (ac, t) => {
    sweep(ac, t, "sine", 300, 90, 0.25, 0.2, 0.3, 0.32);
    noiseBurst(ac, t, 600, 0.2, 0.2, "lowpass");
  },
  count: (ac, t) => tone(ac, t, 1200 + Math.random() * 200, 0.025, "square", 0.025),
  end: (ac, t) => {
    tone(ac, t, 300, 0.2, "triangle", 0.1);
    tone(ac, t + 0.15, 220, 0.3, "triangle", 0.1);
  },
  fanfare: (ac, t) => arpeggio(ac, t, [523, 659, 784, 1047, 784, 1047], 0.09, 0.22),
};

export function playRayadoSfx(ac: AudioContext, name: RayadoSfxName, delaySeconds = 0): void {
  SYNTHS[name](ac, ac.currentTime + delaySeconds);
}

export const RAYADO_SFX_NAMES = Object.keys(SYNTHS) as RayadoSfxName[];
