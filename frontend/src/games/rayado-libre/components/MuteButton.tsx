import { SoundOffIcon, SoundOnIcon } from "../../../components/ui/icons";

interface MuteButtonProps {
  muted: boolean;
  onToggle: () => void;
}

/** Botón de silencio de la cabecera del chat (ver ChatHeader) — la elección se recuerda por dispositivo (ver useRayadoSfx). */
export function MuteButton({ muted, onToggle }: MuteButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={muted}
      aria-label={muted ? "Activar sonido" : "Silenciar sonido"}
      title={muted ? "Activar sonido" : "Silenciar sonido"}
      className="grid size-7 flex-none cursor-pointer place-items-center rounded-lg border border-rl-card-border bg-rl-card text-rl-ink/80 hover:text-rl-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rl-accent-strong"
    >
      <span aria-hidden="true" className="flex items-center justify-center">
        {muted ? <SoundOffIcon size={15} /> : <SoundOnIcon size={15} />}
      </span>
    </button>
  );
}
