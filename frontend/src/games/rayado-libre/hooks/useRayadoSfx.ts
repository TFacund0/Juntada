import { useGameAudio } from "../../../components/game-kit/hooks/useGameAudio";
import { playRayadoSfx, type RayadoSfxName } from "../utils/sfx";

// Sonido y vibración de Rayado por dispositivo: el desbloqueo tras un gesto,
// el silencio recordado y la vibración vienen de game-kit (useGameAudio);
// acá solo se enchufan los sintetizadores propios del juego.
const KEY = "impostorgame:rayado-libre:muted";

export interface RayadoSfx {
  muted: boolean;
  toggleMuted: () => void;
  play: (name: RayadoSfxName, delaySeconds?: number) => void;
  vibrate: (pattern: number | number[]) => void;
}

export function useRayadoSfx(): RayadoSfx {
  const audio = useGameAudio(KEY);
  return {
    muted: audio.muted,
    toggleMuted: audio.toggleMuted,
    play: (name, delaySeconds = 0) => audio.play(ac => playRayadoSfx(ac, name, delaySeconds)),
    vibrate: audio.vibrate,
  };
}
