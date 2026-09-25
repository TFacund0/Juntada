// Recámara's sound effects, synthesized with Web Audio (no audio files),
// ported from docs/referencias/recamara-referencia.html. Each one only
// schedules nodes on the context it's given, starting at `t` — no state of
// its own, so useRecamaraSfx owns the context, muting and error handling.

export type SfxName = "thump" | "bang" | "click" | "rack" | "clink" | "saw" | "lens" | "puff" | "pop" | "load";

type Synth = (ac: AudioContext, t: number) => void;

function noise(ac: AudioContext, seconds: number): AudioBufferSourceNode {
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ac.createBufferSource();
  source.buffer = buffer;
  return source;
}

// Short attack, exponential decay — the shape almost every sound here uses.
function envelope(gain: GainNode, t: number, peak: number, seconds: number): void {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
}

function tone(
  ac: AudioContext,
  t: number,
  type: OscillatorType,
  from: number,
  to: number,
  glide: number,
  peak: number,
  seconds: number,
): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + glide);
  envelope(gain, t, peak, seconds);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + seconds + 0.02);
}

function filteredNoise(
  ac: AudioContext,
  t: number,
  seconds: number,
  filter: BiquadFilterType,
  freq: number,
  q: number,
  peak: number,
): void {
  const source = noise(ac, seconds);
  const biquad = ac.createBiquadFilter();
  const gain = ac.createGain();
  biquad.type = filter;
  biquad.frequency.value = freq;
  biquad.Q.value = q;
  envelope(gain, t, peak, seconds);
  source.connect(biquad).connect(gain).connect(ac.destination);
  source.start(t);
}

const SYNTHS: Record<SfxName, Synth> = {
  // Heartbeat while the gun swings onto its target.
  thump: (ac, t) => tone(ac, t, "sine", 70, 40, 0.18, 0.55, 0.22),
  // Live shell: a filtered noise blast plus a low boom underneath.
  bang: (ac, t) => {
    const source = noise(ac, 1.1);
    const lowpass = ac.createBiquadFilter();
    const gain = ac.createGain();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(5000, t);
    lowpass.frequency.exponentialRampToValueAtTime(180, t + 0.8);
    envelope(gain, t, 1, 1);
    source.connect(lowpass).connect(gain).connect(ac.destination);
    source.start(t);
    tone(ac, t, "sine", 110, 32, 0.4, 0.9, 0.5);
  },
  // Blank: a dry mechanical click, nothing else.
  click: (ac, t) => tone(ac, t, "square", 2200, 300, 0.03, 0.22, 0.05),
  // The pump racking the spent shell out: two short clacks.
  rack: (ac, t) => {
    filteredNoise(ac, t, 0.06, "bandpass", 1400, 3, 0.5);
    filteredNoise(ac, t + 0.13, 0.06, "bandpass", 900, 3, 0.5);
  },
  // The empty casing hitting the table.
  clink: (ac, t) => {
    for (const freq of [2650, 3980, 5200]) tone(ac, t, "triangle", freq, freq, 0.01, 0.06, 0.3);
  },
  saw: (ac, t) => {
    const source = noise(ac, 1.2);
    const bandpass = ac.createBiquadFilter();
    const gain = ac.createGain();
    const lfo = ac.createOscillator();
    const lfoGain = ac.createGain();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 2800;
    bandpass.Q.value = 1.5;
    lfo.frequency.value = 7;
    lfoGain.gain.value = 0.1;
    lfo.connect(lfoGain).connect(gain.gain);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.linearRampToValueAtTime(0, t + 1.15);
    source.connect(bandpass).connect(gain).connect(ac.destination);
    source.start(t);
    lfo.start(t);
    lfo.stop(t + 1.2);
  },
  lens: (ac, t) => tone(ac, t, "sine", 500, 1300, 0.5, 0.08, 0.6),
  puff: (ac, t) => filteredNoise(ac, t, 0.6, "lowpass", 900, 1, 0.15),
  pop: (ac, t) => tone(ac, t, "sine", 420, 900, 0.08, 0.12, 0.12),
  // A shell sliding into the magazine during the reload.
  load: (ac, t) => filteredNoise(ac, t, 0.05, "bandpass", 700, 2, 0.5),
};

export function playSfx(ac: AudioContext, name: SfxName, delaySeconds = 0): void {
  SYNTHS[name](ac, ac.currentTime + delaySeconds);
}
