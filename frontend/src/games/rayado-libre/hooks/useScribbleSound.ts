import { useEffect, useMemo, useRef } from "react";
import type { GameAudio } from "../../../components/game-kit/hooks/useGameAudio";
import { setScribbleSpeed, startScribble, stopScribble, type ScribbleNodes } from "../utils/scribble";

export interface ScribbleSound {
  /** Al apoyar el lápiz: arranca el ruido (en silencio hasta que el trazo se mueve). */
  start: () => void;
  /** Velocidad del trazo, en px del tablero por ms. */
  speed: (pxPerMs: number) => void;
  /** Al levantar el lápiz (o si se corta el gesto). */
  stop: () => void;
}

/**
 * Garabato de marcador mientras se dibuja, solo en el dispositivo de quien
 * dibuja. Pasa por `audio.play`, así que respeta el silencio y el desbloqueo
 * tras un gesto; si se silencia a mitad de un trazo, se corta en el acto.
 */
export function useScribbleSound(audio: Pick<GameAudio, "play" | "muted">): ScribbleSound {
  const nodesRef = useRef<ScribbleNodes | null>(null);
  // `play` cambia de identidad en cada render (useGameAudio no lo memoiza).
  const playRef = useRef(audio.play);
  useEffect(() => {
    playRef.current = audio.play;
  });

  const sound = useMemo<ScribbleSound>(
    () => ({
      start: () => {
        if (nodesRef.current) return;
        playRef.current(ac => {
          nodesRef.current = startScribble(ac);
        });
      },
      speed: pxPerMs => {
        if (nodesRef.current) setScribbleSpeed(nodesRef.current, pxPerMs);
      },
      stop: () => {
        const nodes = nodesRef.current;
        nodesRef.current = null;
        if (nodes) stopScribble(nodes);
      },
    }),
    [],
  );

  useEffect(() => {
    if (audio.muted) sound.stop();
  }, [audio.muted, sound]);
  useEffect(() => sound.stop, [sound]);

  return sound;
}
