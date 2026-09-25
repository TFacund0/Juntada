interface MuteButtonProps {
  muted: boolean;
  onToggle: () => void;
}

/** Botón de silencio de la cabecera del turno — la elección se recuerda por dispositivo (ver useRayadoSfx). */
export function MuteButton({ muted, onToggle }: MuteButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={muted}
      aria-label={muted ? "Activar sonido" : "Silenciar sonido"}
      title={muted ? "Activar sonido" : "Silenciar sonido"}
      className="h-[34px] min-w-[38px] flex-none cursor-pointer whitespace-nowrap rounded-[10px] border border-rl-card-border bg-rl-card px-[10px] text-[13px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rl-accent-strong"
    >
      <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
    </button>
  );
}
