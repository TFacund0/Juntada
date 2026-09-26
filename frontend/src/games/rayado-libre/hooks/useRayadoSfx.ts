import { useEffect, useMemo, useRef } from "react";
import { useGameAudio, vibrate } from "../../../components/game-kit/hooks/useGameAudio";
import { playRayadoSfx, type RayadoSfxName } from "../utils/sfx";
import { useScribbleSound, type ScribbleSound } from "./useScribbleSound";

// Sonido y vibración de Rayado por dispositivo: el desbloqueo tras un gesto,
// el silencio recordado y la vibración vienen de game-kit (useGameAudio);
// acá solo se enchufan los sintetizadores propios del juego.
const KEY = "impostorgame:rayado-libre:muted";

export interface RayadoSfx {
  muted: boolean;
  toggleMuted: () => void;
  play: (name: RayadoSfxName, delaySeconds?: number) => void;
  vibrate: (pattern: number | number[]) => void;
  /** Garabato continuo mientras se dibuja (ver useScribbleSound). */
  scribble: ScribbleSound;
}

export function useRayadoSfx(): RayadoSfx {
  const audio = useGameAudio(KEY);
  const scribble = useScribbleSound(audio);
  // useGameAudio devuelve funciones nuevas en cada render: se leen desde un
  // ref para que el objeto de abajo solo cambie cuando cambia el silencio.
  const audioRef = useRef(audio);
  useEffect(() => {
    audioRef.current = audio;
  });
  const { muted } = audio;
  // Memoizado: los efectos que dependen de `sfx` (ver useChatFeedback) no
  // tienen que volver a correr en cada tecla del chat.
  return useMemo(
    () => ({
      muted,
      toggleMuted: () => audioRef.current.toggleMuted(),
      play: (name: RayadoSfxName, delaySeconds = 0) => audioRef.current.play(ac => playRayadoSfx(ac, name, delaySeconds)),
      vibrate,
      scribble,
    }),
    [muted, scribble],
  );
}
