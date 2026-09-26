// Garabato de marcador mientras se dibuja (`scribbleStart/Speed/Stop` de la
// referencia): ruido en loop por un pasabanda, cuyo volumen y tono siguen la
// velocidad del trazo. A diferencia de los sonidos de sfx.ts, este dura lo
// que dura el trazo, así que devuelve sus nodos para poder moverlo y cortarlo.

export interface ScribbleNodes {
  ac: AudioContext;
  source: AudioBufferSourceNode;
  gain: GainNode;
  filter: BiquadFilterNode;
}

/**
 * Volumen y frecuencia del filtro para una velocidad de trazo.
 *
 * @param speed Velocidad en px del tablero por ms.
 */
export function scribbleLevels(speed: number): { gain: number; frequency: number } {
  return { gain: Math.min(0.09, speed * 0.012), frequency: 1800 + Math.min(2400, speed * 300) };
}

/** Arranca el ruido en silencio (volumen 0): recién suena cuando el trazo se mueve. */
export function startScribble(ac: AudioContext): ScribbleNodes {
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * 2), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ac.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2600;
  filter.Q.value = 0.8;
  const gain = ac.createGain();
  gain.gain.value = 0;
  source.connect(filter).connect(gain).connect(ac.destination);
  source.start();
  return { ac, source, gain, filter };
}

export function setScribbleSpeed(nodes: ScribbleNodes, speed: number): void {
  const t = nodes.ac.currentTime;
  const { gain, frequency } = scribbleLevels(speed);
  nodes.gain.gain.setTargetAtTime(gain, t, 0.03);
  nodes.filter.frequency.setTargetAtTime(frequency, t, 0.05);
}

/** Baja el volumen en ~40 ms y corta la fuente un rato después, para que no haga "clic". */
export function stopScribble(nodes: ScribbleNodes): void {
  try {
    nodes.gain.gain.setTargetAtTime(0, nodes.ac.currentTime, 0.04);
    setTimeout(() => {
      try {
        nodes.source.stop();
      } catch {
        /* ya cortado, o el contexto se cerró */
      }
    }, 200);
  } catch {
    /* el contexto se cerró: ya no suena nada */
  }
}
