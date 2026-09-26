import { useGameAudio } from "../../../components/game-kit/hooks/useGameAudio";
import { playSfx, type SfxName } from "../utils/sfx";

// Per-device sound + vibration for Recámara. The unlock-after-gesture,
// muting and vibration plumbing is shared (see game-kit's useGameAudio);
// this only binds it to Recámara's own synths and storage key. The key must
// stay exactly this one so players keep their saved mute choice.
const KEY = "impostorgame:recamara:muted";

export interface RecamaraSfx {
  muted: boolean;
  toggleMuted: () => void;
  play: (name: SfxName, delaySeconds?: number) => void;
  vibrate: (pattern: number | number[]) => void;
}

export function useRecamaraSfx(): RecamaraSfx {
  const audio = useGameAudio(KEY);
  return {
    muted: audio.muted,
    toggleMuted: audio.toggleMuted,
    play: (name, delaySeconds = 0) => audio.play(ac => playSfx(ac, name, delaySeconds)),
    vibrate: audio.vibrate,
  };
}
