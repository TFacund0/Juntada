import { SoundOffIcon, SoundOnIcon } from "../../../components/ui/icons";

interface SoundToggleProps {
  muted: boolean;
  onToggle: () => void;
}

// Mute button in the duel's turn bar — the choice sticks per device (see
// useRecamaraSfx). Only silences sound; vibration keeps working.
export function SoundToggle({ muted, onToggle }: SoundToggleProps) {
  return (
    <button
      type="button"
      className="sound-toggle"
      onClick={onToggle}
      aria-pressed={muted}
      aria-label={muted ? "Activar sonido" : "Silenciar sonido"}
      title={muted ? "Activar sonido" : "Silenciar sonido"}
    >
      <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {muted ? <SoundOffIcon size={18} /> : <SoundOnIcon size={18} />}
      </span>
    </button>
  );
}
