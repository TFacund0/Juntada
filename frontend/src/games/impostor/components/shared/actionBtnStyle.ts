// Shared "lift on hover, settle on press" animation for every primary/
// success action button across both modes (reveal's "Siguiente jugador",
// discussion's "Listo para votar"/"Empezar votación", vote's "Confirmar
// voto", result's "Nueva partida"/"Siguiente ronda", ...) — before this,
// each screen defined its own copy of the same three CSS rules under a
// differently-named class. The glow color on hover is per-button (success
// green, danger red, or none) via the --impostor-action-glow custom
// property instead of a whole separate class per color — set it inline
// alongside the className, e.g.
// style={{ "--impostor-action-glow": "rgba(93,202,165,0.35)" } as CSSProperties}.
export const actionBtnStyle = `
  .impostor-action-btn {
    transition: transform 0.15s ease-out, filter 0.15s ease-out, box-shadow 0.2s ease-out;
  }
  .impostor-action-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    filter: brightness(1.15);
    box-shadow: 0 8px 20px var(--impostor-action-glow, transparent);
  }
  .impostor-action-btn:active:not(:disabled) {
    transform: scale(0.96);
  }
`;
