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
      className="grid size-7 flex-none cursor-pointer place-items-center rounded-lg border border-rl-card-border bg-rl-card text-[13px] leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rl-accent-strong"
    >
      <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
    </button>
  );
}
